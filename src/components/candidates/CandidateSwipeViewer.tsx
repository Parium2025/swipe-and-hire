import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
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
}: CandidateSwipeViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const candidateRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* ── Premium media preloading: bulk-25 on open, rolling 10 ahead / 2 back ── */
  useCandidateMediaPreloader(applications, currentIndex, open, 10, 2, 25);

  // Scroll to initial candidate on open
  useEffect(() => {
    if (open && scrollRef.current && candidateRefs.current[initialIndex]) {
      candidateRefs.current[initialIndex]?.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // Track current candidate via scroll position — simple & reliable
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;
    let bestIdx = 0;
    let bestDistance = Infinity;

    candidateRefs.current.forEach((el, idx) => {
      if (!el) return;
      const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIdx = idx;
      }
    });

    setCurrentIndex(prev => prev !== bestIdx ? bestIdx : prev);
  }, []);

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

        {/* Dot indicator — vertically centered, aligned on center axis */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5">
          {applications.map((_, idx) => (
            <div
              key={idx}
              className={`rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/30'}`}
            />
          ))}
        </div>

        {/* Continuous scroll container */}
        <div
          ref={scrollRef}
          className="h-full w-full overflow-y-auto overscroll-contain pt-12"
          style={{ WebkitOverflowScrolling: 'touch', willChange: 'scroll-position', contain: 'layout style' }}
        >
          {applications.map((app, idx) => (
            <div key={app.id} ref={(el) => { candidateRefs.current[idx] = el; }} data-index={idx} className="w-full">
              <CandidateSlide
                application={app}
                rating={getDisplayRating(app)}
                onOpenFullProfile={() => onOpenFullProfile(app)}
                onRemoveFromList={onRemoveCandidate ? () => onRemoveCandidate(app) : undefined}
                isLast={idx === applications.length - 1}
                isVisible={Math.abs(idx - currentIndex) <= 1}
              />
            </div>
          ))}
          <div className="h-[env(safe-area-inset-bottom,2rem)]" />
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
});
