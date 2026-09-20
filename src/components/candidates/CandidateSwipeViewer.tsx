import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CandidateSlide, type CandidateSlideSwipeApi } from './CandidateSlide';
import { CandidateSlideActions } from './CandidateSlideActions';
import { SwipeHeader } from '@/components/swipe/SwipeHeader';
import { SwipeDots } from '@/components/swipe/SwipeDots';
import { useCandidateMediaPreloader } from '@/hooks/useCandidateMediaPreloader';
import type { ApplicationData } from '@/hooks/useApplicationsData';
import { TruncatedText } from '@/components/ui/truncated-text';

export interface CandidateSwipeFilter {
  question: string;
  answers: string[];
}


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
  /** Kandidater som redan finns i en lista — spara-knappen visas ifylld och låst. */
  savedApplicantIds?: Set<string>;
  /** Öppnar listväljaren för kandidaten. */
  onSaveCandidate?: (application: ApplicationData) => void;
  /** Kvar monterad bakom kandidatprofilen — inget blixtrar fram och positionen bevaras. */
  behind?: boolean;
  /** Frågefilter som skapade urvalet. Visas stabilt över varje kort. */
  activeQuestionFilters?: CandidateSwipeFilter[];
}

/* ── Main Viewer ────────────────────────────────── */
export const CandidateSwipeViewer = memo(function CandidateSwipeViewer({
  applications,
  initialIndex,
  open,
  onClose,
  onOpenFullProfile,
  getDisplayRating,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  savedApplicantIds,
  onSaveCandidate,
  behind = false,
  activeQuestionFilters = [],
}: CandidateSwipeViewerProps) {

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeCardSwipeRef = useRef<((direction: 'left' | 'right') => void) | null>(null);
  const rejectedStackRef = useRef<number[]>([]);
  const [rejectedStackSize, setRejectedStackSize] = useState(0);
  const [cardVersions, setCardVersions] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  // Helskärmssvep: varje kandidat är exakt en viewport hög.
  const [slideHeight, setSlideHeight] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight
  );

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const apply = () => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;pointer-events:none;visibility:hidden;';
      document.body.appendChild(probe);
      const h = probe.getBoundingClientRect().height || window.innerHeight;
      document.body.removeChild(probe);
      setSlideHeight(prev => (Math.abs(prev - h) > 1 ? h : prev));
    };
    apply();
    window.addEventListener('orientationchange', apply);
    return () => {
      window.removeEventListener('orientationchange', apply);
    };
  }, [open]);

  const virtualizer = useVirtualizer({
    count: applications.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => slideHeight,
    overscan: 2,
    getItemKey: (index) => applications[index]?.id || index,
  });

  // Räkna om positionerna när viewporthöjden ändras (rotation, Safari-fält).
  useEffect(() => {
    virtualizer.measure();
  }, [slideHeight, virtualizer]);


  /* ── Premium media preloading: bulk-25 on open, rolling 10 ahead / 2 back ── */
  useCandidateMediaPreloader(applications, currentIndex, open, 10, 2, 25);



  // Scrolla till startkandidaten EN gång per öppning — aldrig igen när listan
  // uppdateras (kallstart/efterladdning byter arrayidentitet, vilket tidigare
  // kastade tillbaka användaren till första kandidaten mitt i bläddringen).
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (!open) {
      didInitialScrollRef.current = false;
      return;
    }
    if (behind || didInitialScrollRef.current) return;
    if (!applications[initialIndex]) return;
    didInitialScrollRef.current = true;
    setCurrentIndex(initialIndex);
    requestAnimationFrame(() => virtualizer.scrollToIndex(initialIndex, { align: 'start' }));
  }, [open, behind, initialIndex, applications, virtualizer]);


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

  const goToIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= applications.length) return;
    setCurrentIndex(idx);
    virtualizer.scrollToIndex(idx, { align: 'start', behavior: 'smooth' });
  }, [applications.length, virtualizer]);

  const registerActiveSwipeApi = useCallback((api: CandidateSlideSwipeApi | null) => {
    activeCardSwipeRef.current = api?.swipe ?? null;
  }, []);

  const handleReject = useCallback((index: number, applicationId: string) => {
    rejectedStackRef.current = [...rejectedStackRef.current, index];
    setRejectedStackSize(rejectedStackRef.current.length);
    setCardVersions((previous) => ({
      ...previous,
      [applicationId]: (previous[applicationId] ?? 0) + 1,
    }));
    goToIndex(Math.min(index + 1, applications.length - 1));
  }, [applications.length, goToIndex]);

  const handleUndo = useCallback(() => {
    const previousIndex = rejectedStackRef.current.at(-1);
    if (previousIndex === undefined) return;
    rejectedStackRef.current = rejectedStackRef.current.slice(0, -1);
    setRejectedStackSize(rejectedStackRef.current.length);
    goToIndex(previousIndex);
  }, [goToIndex]);

  const handleActionReject = useCallback(() => {
    activeCardSwipeRef.current?.('left');
  }, []);

  const handleActionInfo = useCallback(() => {
    activeCardSwipeRef.current?.('right');
  }, []);

  const currentApplication = applications[currentIndex];


  // Lätt haptik vid kandidatbyte — endast i svepvyn, aldrig vid första renderingen.
  const lastHapticIndex = useRef<number | null>(null);
  useEffect(() => {
    if (!open) {
      lastHapticIndex.current = null;
      return;
    }
    if (lastHapticIndex.current === null) {
      lastHapticIndex.current = currentIndex;
      return;
    }
    if (lastHapticIndex.current === currentIndex) return;
    lastHapticIndex.current = currentIndex;
    try {
      navigator.vibrate?.(8);
    } catch {
      // Vissa webbläsare blockerar vibration — ignorera tyst.
    }
  }, [open, currentIndex]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  useEffect(() => {
    if (open) return;
    rejectedStackRef.current = [];
    setRejectedStackSize(0);
    setCardVersions({});
  }, [open]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`fixed inset-0 bg-parium-gradient ${behind ? 'z-[40] pointer-events-none' : 'z-[100]'}`}
        aria-hidden={behind || undefined}
      >
        <SwipeHeader
          displayIndex={applications.length === 0 ? 0 : Math.min(currentIndex + 1, applications.length)}
          totalCount={applications.length}
          hasFilter={false}
          activeFilterCount={0}
          onFilterOpen={() => undefined}
          onClose={onClose}
        />

        {activeQuestionFilters.length > 0 && (
          <div className="pointer-events-none absolute left-4 right-16 top-[calc(env(safe-area-inset-top,0px)+3.25rem)] z-20">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-white/20 bg-card-parium/90 px-3 py-2 shadow-lg backdrop-blur-md">
              <span className="shrink-0 text-[11px] font-semibold uppercase text-white">Filter</span>
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
                {activeQuestionFilters.map((filter) => {
                  const answer = filter.answers.length === 0 ? 'Alla' : filter.answers.join(', ');
                  const label = `${filter.question}: ${answer}`;
                  return (
                    <span
                      key={`${filter.question}:${answer}`}
                      className="pointer-events-auto inline-flex min-w-0 max-w-full shrink rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white"
                    >
                      <TruncatedText text={label} className="min-w-0 truncate" />
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <SwipeDots
          count={applications.length}
          currentIndex={currentIndex}
          isEndStateActive={false}
          onScrubTo={goToIndex}
        />

        {applications.length === 0 && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center px-8 text-center">
            <p className="text-white font-semibold">Inga kandidater att svepa igenom</p>
            <p className="mt-2 text-sm text-white">Lägg till kandidater i din lista eller ändra dina urvalskriterier.</p>
          </div>
        )}

        {/* Helskärmssvep — en kandidat per skärm, med snapp */}
        <div
          ref={scrollRef}
          className="h-full w-full overflow-x-hidden overflow-y-auto overscroll-contain"
          style={{
            WebkitOverflowScrolling: 'touch',
            willChange: 'scroll-position',
            contain: 'layout style',
            scrollSnapType: 'y mandatory',
            touchAction: 'pan-y',
          }}
        >
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((item) => {
            const app = applications[item.index];
            if (!app) return null;
            return (
            <div
               key={`${app.id}:${cardVersions[app.id] ?? 0}`}
              data-index={item.index}
              className="absolute left-0 top-0 w-full"
              style={{
                transform: `translateY(${item.start}px)`,
                height: `${slideHeight}px`,
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
              }}
            >
              <div className="h-full w-full">
              <CandidateSlide
                application={app}
                nextApplication={item.index === currentIndex ? applications[item.index + 1] : undefined}
                rating={getDisplayRating(app)}
                onOpenFullProfile={() => onOpenFullProfile(app)}
                onRemoveFromList={onRemoveCandidate ? () => onRemoveCandidate(app) : undefined}
                isVisible={Math.abs(item.index - currentIndex) <= 1}
                isActive={item.index === currentIndex}
                overlayOpen={behind}
                onSwipeLeft={() => handleReject(item.index, app.id)}
                onSwipeRight={() => onOpenFullProfile(app)}
                onRegisterSwipeApi={registerActiveSwipeApi}

              />
              </div>
            </div>
            );
          })}
          </div>
        </div>

        {currentApplication && (
          <div
            className="pointer-events-none absolute inset-x-0 z-30 px-5"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.25rem)' }}
          >
            <div className="pointer-events-auto flex justify-center">
              <CandidateSlideActions
                saved={savedApplicantIds ? savedApplicantIds.has(currentApplication.applicant_id) : false}
                onSave={() => onSaveCandidate?.(currentApplication)}
                onSkip={handleActionReject}
                onOpenInfo={handleActionInfo}
                canUndo={rejectedStackSize > 0}
                onUndo={handleUndo}
              />
            </div>
          </div>
        )}

      </motion.div>
    </AnimatePresence>,
    document.body
  );
});
