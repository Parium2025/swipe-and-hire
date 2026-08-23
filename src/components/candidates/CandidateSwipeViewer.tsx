import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CandidateSlide } from './CandidateSlide';
import { useCandidateMediaPreloader } from '@/hooks/useCandidateMediaPreloader';
import type { ApplicationData } from '@/hooks/useApplicationsData';

interface CandidateSwipeViewerProps {
  applications: ApplicationData[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onOpenFullProfile: (application: ApplicationData) => void;
  getDisplayRating: (app: ApplicationData) => number;
  onRemoveCandidate?: (application: ApplicationData) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

/* ── Main Viewer ────────────────────────────────── */
export const CandidateSwipeViewer = memo(function CandidateSwipeViewer({
  applications,
  initialIndex,
  open,
  onClose,
  onOpenFullProfile,
  getDisplayRating,
  onRemoveCandidate,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: CandidateSwipeViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const virtualizer = useVirtualizer({
    count: applications.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 980,
    overscan: 2,
    getItemKey: (index) => applications[index]?.id || index,
  });

  /* ── Premium media preloading: bulk-25 on open, rolling 10 ahead / 2 back ── */
  useCandidateMediaPreloader(applications, currentIndex, open, 10, 2, 25);

  // Scroll to initial candidate on open
  useEffect(() => {
    if (open && applications[initialIndex]) {
      setCurrentIndex(initialIndex);
      requestAnimationFrame(() => virtualizer.scrollToIndex(initialIndex, { align: 'start' }));
    }
  }, [open, initialIndex, applications, virtualizer]);

  // Track current candidate via scroll position — simple & reliable
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    let bestIdx = currentIndex;
    let bestDistance = Infinity;

    virtualizer.getVirtualItems().forEach((item) => {
      const dist = Math.abs(item.start - container.scrollTop);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIdx = item.index;
      }
    });

    setCurrentIndex(prev => prev !== bestIdx ? bestIdx : prev);
    if (hasMore && !isLoadingMore && bestIdx >= applications.length - 8) {
      onLoadMore?.();
    }
  }, [applications.length, currentIndex, hasMore, isLoadingMore, onLoadMore, virtualizer]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!open || !container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [open, handleScroll]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] bg-card-parium"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
          <div className="py-3">
            <span className="text-xs text-white font-medium tabular-nums">
              {currentIndex + 1} / {applications.length}
            </span>
          </div>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center touch-manipulation" aria-label="Stäng">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <X className="h-5 w-5 text-white" />
            </div>
          </button>
        </div>

        {/* Compact position indicator — never creates thousands of DOM nodes. */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5">
          {Array.from({ length: Math.min(applications.length, 7) }, (_, offset) => {
            const start = Math.max(0, Math.min(currentIndex - 3, applications.length - 7));
            const idx = start + offset;
            return (
            <div
              key={idx}
              className={`rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/30'}`}
            />
            );
          })}
        </div>

        {/* Continuous scroll container */}
        <div
          ref={scrollRef}
          className="h-full w-full overflow-y-auto overscroll-contain pt-12"
          style={{ WebkitOverflowScrolling: 'touch', willChange: 'scroll-position', contain: 'layout style' }}
        >
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((item) => {
            const app = applications[item.index];
            if (!app) return null;
            return (
            <div
              key={app.id}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <CandidateSlide
                application={app}
                rating={getDisplayRating(app)}
                onOpenFullProfile={() => onOpenFullProfile(app)}
                onRemoveFromList={onRemoveCandidate ? () => onRemoveCandidate(app) : undefined}
                isLast={item.index === applications.length - 1}
                isVisible={Math.abs(item.index - currentIndex) <= 1}
              />
            </div>
            );
          })}
          </div>
          <div className="h-[env(safe-area-inset-bottom,2rem)]" />
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
});
