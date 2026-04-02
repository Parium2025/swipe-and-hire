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

const SCROLL_SNAP_DELAY = 70;
const END_BOUNCE_DELAY = 680;
const END_BOUNCE_HIDE_DELAY = 420;
const END_BOUNCE_TRIGGER_OFFSET = 12;
const END_STATE_HEIGHT = 'calc(100dvh - 4rem)';
const SNAP_REVEAL_OFFSET = 96;

export const SwipeFullscreen = memo(function SwipeFullscreen({ jobs, appliedJobIds, onClose, filterState }: SwipeFullscreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const endSectionRef = useRef<HTMLDivElement | null>(null);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endBounceActiveRef = useRef(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [localAppliedIds, setLocalAppliedIds] = useState<Set<string>>(new Set());
  const [showEndBounce, setShowEndBounce] = useState(false);
  const [endStateVisible, setEndStateVisible] = useState(false);
  const [isReturningFromEnd, setIsReturningFromEnd] = useState(false);

  const isApplied = useCallback(
    (jobId: string) => appliedJobIds.has(jobId) || localAppliedIds.has(jobId),
    [appliedJobIds, localAppliedIds]
  );

  const currentJob = jobs[currentIndex];
  const isEndStateActive = endStateVisible || showEndBounce;
  const displayIndex = isEndStateActive ? jobs.length + 1 : Math.min(currentIndex + 1, jobs.length);

  const clearTimers = useCallback(() => {
    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = null;
    }

    if (bounceReturnTimerRef.current) {
      clearTimeout(bounceReturnTimerRef.current);
      bounceReturnTimerRef.current = null;
    }

    if (bounceHideTimerRef.current) {
      clearTimeout(bounceHideTimerRef.current);
      bounceHideTimerRef.current = null;
    }
  }, []);

  const getSlideScrollTop = useCallback((index: number) => {
    const container = scrollRef.current;
    const slide = slideRefs.current[index];

    if (!container || !slide) return null;

    const paddingTop = Number.parseFloat(window.getComputedStyle(container).paddingTop) || 0;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);

    return Math.min(Math.max(slide.offsetTop - paddingTop, 0), maxScrollTop);
  }, []);

  const getEndStateScrollTop = useCallback(() => {
    const container = scrollRef.current;
    const endSection = endSectionRef.current;

    if (!container || !endSection) return null;

    const paddingTop = Number.parseFloat(window.getComputedStyle(container).paddingTop) || 0;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);

    return Math.min(Math.max(endSection.offsetTop - paddingTop, 0), maxScrollTop);
  }, []);

  const scrollToSlide = useCallback((index: number) => {
    const container = scrollRef.current;
    const targetTop = getSlideScrollTop(index);

    if (!container || targetTop === null) return;

    container.scrollTo({
      top: targetTop,
      behavior: 'smooth',
    });
  }, [getSlideScrollTop]);

  const triggerEndBounce = useCallback(() => {
    if (jobs.length === 0 || showEndBounce || endBounceActiveRef.current) return;

    endBounceActiveRef.current = true;
    clearTimers();
    setIsReturningFromEnd(false);
    setShowEndBounce(true);
    setEndStateVisible(true);
    setCurrentIndex(jobs.length - 1);

    const lastIndex = jobs.length - 1;

    bounceReturnTimerRef.current = setTimeout(() => {
      const container = scrollRef.current;
      const targetTop = getSlideScrollTop(lastIndex);

      setIsReturningFromEnd(true);

      if (container && targetTop !== null) {
        setShowEndBounce(false);
        setEndStateVisible(false);

        requestAnimationFrame(() => {
          container.scrollTo({ top: targetTop, behavior: 'smooth' });
        });
      } else {
        setShowEndBounce(false);
        setEndStateVisible(false);
      }

      bounceReturnTimerRef.current = null;

      bounceHideTimerRef.current = setTimeout(() => {
        setIsReturningFromEnd(false);
        endBounceActiveRef.current = false;
        bounceHideTimerRef.current = null;
      }, END_BOUNCE_HIDE_DELAY);
    }, END_BOUNCE_DELAY);
  }, [clearTimers, getSlideScrollTop, jobs.length, showEndBounce]);

  useEffect(() => {
    setCurrentIndex(0);
    setShowEndBounce(false);
    setEndStateVisible(false);
    setIsReturningFromEnd(false);
    clearTimers();
    endBounceActiveRef.current = false;
    slideRefs.current = slideRefs.current.slice(0, jobs.length);

    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0 });
    }
  }, [jobs.length, clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || showEndBounce) return;

    const scrollTop = container.scrollTop;
    const endStateTop = getEndStateScrollTop();
    const hasReachedEndState = !isReturningFromEnd && endStateTop !== null && scrollTop >= Math.max(0, endStateTop - SNAP_REVEAL_OFFSET);

    setEndStateVisible(hasReachedEndState);

    let bestIdx = 0;
    let bestDist = Infinity;

    slideRefs.current.forEach((el, idx) => {
      if (!el) return;
      const slideScrollTop = getSlideScrollTop(idx);
      if (slideScrollTop === null) return;

      const dist = Math.abs(slideScrollTop - scrollTop);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });

    setCurrentIndex(prev => (prev !== bestIdx ? bestIdx : prev));
  }, [getEndStateScrollTop, getSlideScrollTop, isReturningFromEnd, showEndBounce]);

  const handleScrollWithSnap = useCallback(() => {
    handleScroll();
    if (showEndBounce) return;

    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current);
    }

    scrollEndTimerRef.current = setTimeout(() => {
      const container = scrollRef.current;
      if (!container || jobs.length === 0) return;

      const scrollTop = container.scrollTop;
      const endStateTop = getEndStateScrollTop();
      const hasScrolledIntoEndState =
        currentIndex === jobs.length - 1 &&
        endStateTop !== null &&
        scrollTop >= endStateTop - END_BOUNCE_TRIGGER_OFFSET;

      if (hasScrolledIntoEndState) {
        triggerEndBounce();
        scrollEndTimerRef.current = null;
        return;
      }

      scrollEndTimerRef.current = null;
    }, SCROLL_SNAP_DELAY);
  }, [currentIndex, getEndStateScrollTop, handleScroll, jobs.length, showEndBounce, triggerEndBounce]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScrollWithSnap, { passive: true });
    return () => container.removeEventListener('scroll', handleScrollWithSnap);
  }, [handleScrollWithSnap]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showDetail || showApply || showFilter) return;
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showDetail, showApply, showFilter, onClose]);

  const scrollToNext = useCallback(() => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < jobs.length) {
      scrollToSlide(nextIdx);
    }
  }, [currentIndex, jobs.length, scrollToSlide]);

  const handleSwipeRight = useCallback(() => {
    setShowApply(true);
  }, []);

  const handleSwipeLeft = useCallback(() => {
    if (currentIndex >= jobs.length - 1) return;
    scrollToNext();
  }, [currentIndex, jobs.length, scrollToNext]);

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

    if (currentIndex >= jobs.length - 1) {
      return;
    }

    setTimeout(scrollToNext, 300);
  }, [currentIndex, currentJob, jobs.length, scrollToNext]);

  const handleCloseApply = useCallback(() => {
    setShowApply(false);
  }, []);

  if (jobs.length === 0) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-parium-gradient flex flex-col">
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

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-5 border border-white/20">
            <p className="text-white text-base font-medium text-center">Inga jobb hittades</p>
          </div>
        </div>

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
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
          <div className="py-3">
            <span className="text-xs text-white font-medium tabular-nums">
              {displayIndex} / {jobs.length}
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

        {jobs.length <= 30 && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1">
            {Array.from({ length: jobs.length + (isEndStateActive ? 1 : 0) }).map((_, idx) => {
              const isEndDot = idx === jobs.length;
              const isActive = isEndDot ? isEndStateActive : idx === currentIndex && !isEndStateActive;

              return (
                <div
                  key={idx}
                  className={`rounded-full transition-all duration-300 ${
                    isActive ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/30'
                  }`}
                />
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {isReturningFromEnd && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0.72 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-x-0 top-16 bottom-0 z-10 bg-parium-gradient"
            />
          )}
        </AnimatePresence>

        <div
          ref={scrollRef}
          className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain snap-y snap-mandatory pt-16"
          style={{
            WebkitOverflowScrolling: 'touch',
            willChange: 'scroll-position',
            contain: 'layout style',
            scrollPaddingTop: '4rem',
          }}
        >
          {jobs.map((job, idx) => (
            <div
              key={job.id}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              data-index={idx}
              className="w-full shrink-0 snap-start snap-always"
              style={{ minHeight: END_STATE_HEIGHT, height: END_STATE_HEIGHT }}
            >
              <motion.div
                className="h-full"
                initial={false}
                animate={
                  idx === jobs.length - 1 && isReturningFromEnd
                    ? { opacity: [0.82, 1], scale: [0.985, 1] }
                    : { opacity: 1, scale: 1 }
                }
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              >
                <JobSlide
                  job={job}
                  applied={isApplied(job.id)}
                  isVisible={Math.abs(idx - currentIndex) <= 1}
                  isLast={idx === jobs.length - 1}
                  sectionHeight={END_STATE_HEIGHT}
                  onSwipeRight={handleSwipeRight}
                  onSwipeLeft={handleSwipeLeft}
                  onTap={handleTap}
                />
              </motion.div>
            </div>
          ))}

          <div
            ref={endSectionRef}
            aria-hidden="true"
            className="w-full shrink-0 snap-start snap-always flex items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
            style={{ minHeight: END_STATE_HEIGHT, height: END_STATE_HEIGHT }}
          >
            <motion.div
              initial={false}
              animate={
                showEndBounce
                  ? { opacity: 1, scale: 1, y: -8, filter: 'blur(0px)' }
                  : endStateVisible
                    ? { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }
                    : { opacity: 0, scale: 0.94, y: 30, filter: 'blur(10px)' }
              }
              transition={{
                opacity: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                scale: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                y: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
                filter: { duration: 0.28, ease: 'easeOut' },
              }}
              className="w-full max-w-[27rem] rounded-[1.75rem] border border-white/25 bg-white/10 px-8 py-6 backdrop-blur-sm"
            >
              <motion.p
                initial={false}
                animate={endStateVisible || showEndBounce ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: endStateVisible || showEndBounce ? 0.05 : 0 }}
                className="text-center text-[15px] font-medium text-white sm:text-base"
              >
                Inga fler jobb just nu
              </motion.p>
            </motion.div>
          </div>
        </div>

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