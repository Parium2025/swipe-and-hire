import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal } from 'lucide-react';
import { JobSlide } from '@/components/swipe/JobSlide';
import { SwipeJobDetail } from '@/components/swipe/SwipeJobDetail';
import { SwipeApplySheet } from '@/components/swipe/SwipeApplySheet';
import { SwipeFilterSheet } from '@/components/swipe/SwipeFilterSheet';
import type { SwipeJob } from '@/components/swipe/SwipeCard';

export type { SwipeJob };

export interface SwipeFilterState {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  selectedCity: string;
  onLocationChange: (location: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedEmploymentTypes: string[];
  onEmploymentTypesChange: (value: string[]) => void;
  sortBy: 'newest' | 'oldest' | 'most-views';
  onSortChange: (value: 'newest' | 'oldest' | 'most-views') => void;
  onClearAll: () => void;
  activeFilterCount: number;
}

interface SwipeFullscreenProps {
  jobs: SwipeJob[];
  appliedJobIds: Set<string>;
  onClose: () => void;
  filterState?: SwipeFilterState;
}

export const SwipeFullscreen = memo(function SwipeFullscreen({ jobs, appliedJobIds, onClose, filterState }: SwipeFullscreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [localAppliedIds, setLocalAppliedIds] = useState<Set<string>>(new Set());
  const [showEndBounce, setShowEndBounce] = useState(false);

  const isApplied = useCallback(
    (jobId: string) => appliedJobIds.has(jobId) || localAppliedIds.has(jobId),
    [appliedJobIds, localAppliedIds]
  );

  const currentJob = jobs[currentIndex];

  // Reset index when jobs change (filter applied)
  useEffect(() => {
    setCurrentIndex(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0 });
    }
  }, [jobs.length]);

  // Track current slide via scroll position
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;
    let bestIdx = 0;
    let bestDist = Infinity;
    slideRefs.current.forEach((el, idx) => {
      if (!el) return;
      const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    setCurrentIndex(prev => prev !== bestIdx ? bestIdx : prev);
  }, []);

  // Manual snap on scroll end — bounce back from end slide
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endBounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScrollWithSnap = useCallback(() => {
    handleScroll();
    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    scrollEndTimerRef.current = setTimeout(() => {
      const container = scrollRef.current;
      if (!container) return;
      const containerTop = container.getBoundingClientRect().top;
      let bestIdx = 0;
      let bestDist = Infinity;
      slideRefs.current.forEach((el, idx) => {
        if (!el) return;
        const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });

      // If scrolled past the last real slide into the end-bounce zone
      if (bestIdx === jobs.length - 1) {
        const lastSlide = slideRefs.current[bestIdx];
        if (lastSlide) {
          const lastBottom = lastSlide.getBoundingClientRect().bottom;
          const containerBottom = container.getBoundingClientRect().bottom;
          // If the last slide is mostly scrolled past (user scrolled into end zone)
          if (lastBottom < containerTop + container.clientHeight * 0.4) {
            // Show end bounce then snap back
            setShowEndBounce(true);
            if (endBounceTimerRef.current) clearTimeout(endBounceTimerRef.current);
            endBounceTimerRef.current = setTimeout(() => {
              setShowEndBounce(false);
              slideRefs.current[bestIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 1200);
            return;
          }
        }
      }

      slideRefs.current[bestIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [handleScroll, jobs.length]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScrollWithSnap, { passive: true });
    return () => container.removeEventListener('scroll', handleScrollWithSnap);
  }, [handleScrollWithSnap]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showDetail || showApply || showFilter) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showDetail, showApply, showFilter, onClose]);

  // Scroll to next slide helper
  const scrollToNext = useCallback(() => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < jobs.length && slideRefs.current[nextIdx]) {
      slideRefs.current[nextIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentIndex, jobs.length]);

  // Bounce-back when swiping on last job
  const triggerEndBounce = useCallback(() => {
    setShowEndBounce(true);
    setTimeout(() => {
      setShowEndBounce(false);
      // Scroll back to current (last) card
      slideRefs.current[currentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 1200);
  }, [currentIndex]);

  const handleSwipeRight = useCallback((job: SwipeJob) => {
    setShowApply(true);
  }, []);

  const handleSwipeLeft = useCallback(() => {
    if (currentIndex >= jobs.length - 1) {
      triggerEndBounce();
    } else {
      scrollToNext();
    }
  }, [scrollToNext, currentIndex, jobs.length, triggerEndBounce]);

  const handleTap = useCallback(() => {
    setShowDetail(true);
  }, []);

  const handleApplyFromDetail = useCallback(() => {
    setShowDetail(false);
    setShowApply(true);
  }, []);

  const handleApplied = useCallback(() => {
    if (currentJob) {
      setLocalAppliedIds(prev => new Set(prev).add(currentJob.id));
    }
    setShowApply(false);
    setTimeout(scrollToNext, 300);
  }, [currentJob, scrollToNext]);

  const handleCloseApply = useCallback(() => {
    setShowApply(false);
  }, []);

  // Empty state — no jobs at all
  if (jobs.length === 0) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-parium-gradient flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
          <div className="py-3">
            <span className="text-xs text-white font-medium tabular-nums">0 / 0</span>
          </div>
          {filterState && (
            <button
              onClick={() => setShowFilter(true)}
              className="flex items-center gap-2 h-12 px-6 rounded-full bg-white/10 border border-white/20 active:scale-[0.97] transition-colors touch-manipulation"
            >
              <SlidersHorizontal className="h-4.5 w-4.5 text-white" />
              <span className="text-[15px] text-white font-medium">Visa filter</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center touch-manipulation"
            aria-label="Stäng"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors">
              <X className="h-5 w-5 text-white" />
            </div>
          </button>
        </div>

        {/* Centered message */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-5 border border-white/20">
            <p className="text-white text-base font-medium text-center">Inga jobb hittades</p>
          </div>
        </div>

        {/* Filter sheet */}
        {filterState && (
          <SwipeFilterSheet
            open={showFilter}
            onClose={() => setShowFilter(false)}
            searchInput={filterState.searchInput}
            onSearchInputChange={filterState.onSearchInputChange}
            selectedCity={filterState.selectedCity}
            onLocationChange={filterState.onLocationChange}
            selectedCategory={filterState.selectedCategory}
            onCategoryChange={filterState.onCategoryChange}
            selectedEmploymentTypes={filterState.selectedEmploymentTypes}
            onEmploymentTypesChange={filterState.onEmploymentTypesChange}
            sortBy={filterState.sortBy}
            onSortChange={filterState.onSortChange}
            onClearAll={filterState.onClearAll}
            jobCount={0}
            activeFilterCount={filterState.activeFilterCount}
          />
        )}
      </div>,
      document.body
    );
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9999] bg-parium-gradient"
      >
        {/* Header — counter + close */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
          <div className="py-3">
            <span className="text-xs text-white font-medium tabular-nums">
              {currentIndex + 1} / {jobs.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center touch-manipulation"
            aria-label="Stäng"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 [@media(hover:hover)]:hover:bg-white/20 transition-colors">
              <X className="h-5 w-5 text-white" />
            </div>
          </button>
        </div>

        {/* Sticky centered filter button */}
        {filterState && (
          <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2 pt-[env(safe-area-inset-top,0px)] pointer-events-none">
            <div className="py-3">
              <button
                onClick={() => setShowFilter(true)}
                className="pointer-events-auto relative flex items-center gap-2 h-12 px-6 rounded-full bg-white/10 border border-white/20 [@media(hover:hover)]:hover:bg-white/20 transition-colors active:scale-[0.97] touch-manipulation"
                aria-label="Visa filter"
              >
                <SlidersHorizontal className="h-4.5 w-4.5 text-white" />
                <span className="text-[15px] text-white font-medium">Visa filter</span>
                {filterState.activeFilterCount > 0 && (
                  <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-secondary text-white text-[11px] font-bold leading-none">
                    {filterState.activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Dot indicator */}
        {jobs.length <= 30 && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1">
            {jobs.map((_, idx) => (
              <div
                key={idx}
                className={`rounded-full transition-all duration-300 ${
                  idx === currentIndex ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/30'
                }`}
              />
            ))}
          </div>
        )}

        {/* TikTok scroll container — extra top padding for filter button clearance */}
        <div
          ref={scrollRef}
          className="h-full w-full overflow-y-auto overscroll-contain pt-16"
          style={{ WebkitOverflowScrolling: 'touch', willChange: 'scroll-position', contain: 'layout style' }}
        >
          {jobs.map((job, idx) => (
            <div
              key={job.id}
              ref={(el) => { slideRefs.current[idx] = el; }}
              data-index={idx}
              className="w-full"
            >
              <JobSlide
                job={job}
                applied={isApplied(job.id)}
                isVisible={Math.abs(idx - currentIndex) <= 1}
                isLast={idx === jobs.length - 1}
                onSwipeRight={() => handleSwipeRight(job)}
                onSwipeLeft={handleSwipeLeft}
                onTap={handleTap}
              />
            </div>
          ))}
          {/* End bounce zone — scrollable area past last job */}
          <div className="w-full flex items-center justify-center" style={{ minHeight: '70vh' }}>
            <AnimatePresence>
              {showEndBounce && (
                <motion.div
                  className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-5 border border-white/20"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                >
                  <p className="text-white text-base font-medium text-center">Inga fler jobb just nu</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="h-[env(safe-area-inset-bottom,2rem)]" />
        </div>

        {/* Job detail sheet */}
        {currentJob && showDetail && (
          <div className="fixed inset-0 z-[10000] pointer-events-none">
            <div className="relative w-full h-full pointer-events-auto">
              <SwipeJobDetail
                job={currentJob}
                open={showDetail}
                onClose={() => setShowDetail(false)}
                onApply={handleApplyFromDetail}
                hasApplied={isApplied(currentJob.id)}
              />
            </div>
          </div>
        )}

        {/* Apply sheet */}
        {currentJob && showApply && (
          <div className="fixed inset-0 z-[10001] pointer-events-none">
            <div className="relative w-full h-full pointer-events-auto">
              <SwipeApplySheet
                jobId={currentJob.id}
                jobTitle={currentJob.title}
                companyName={currentJob.company_name}
                open={showApply}
                onClose={handleCloseApply}
                onApplied={handleApplied}
              />
            </div>
          </div>
        )}

        {/* Filter sheet */}
        {filterState && (
          <SwipeFilterSheet
            open={showFilter}
            onClose={() => setShowFilter(false)}
            searchInput={filterState.searchInput}
            onSearchInputChange={filterState.onSearchInputChange}
            selectedCity={filterState.selectedCity}
            onLocationChange={filterState.onLocationChange}
            selectedCategory={filterState.selectedCategory}
            onCategoryChange={filterState.onCategoryChange}
            selectedEmploymentTypes={filterState.selectedEmploymentTypes}
            onEmploymentTypesChange={filterState.onEmploymentTypesChange}
            sortBy={filterState.sortBy}
            onSortChange={filterState.onSortChange}
            onClearAll={filterState.onClearAll}
            jobCount={jobs.length}
            activeFilterCount={filterState.activeFilterCount}
          />
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
});
