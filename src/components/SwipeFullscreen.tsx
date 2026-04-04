import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { JobSlide } from '@/components/swipe/JobSlide';
import { SwipeJobDetail } from '@/components/swipe/SwipeJobDetail';
import { SwipeApplySheet } from '@/components/swipe/SwipeApplySheet';
import { SwipeFilterSheet } from '@/components/swipe/SwipeFilterSheet';
import { SwipeHeader } from '@/components/swipe/SwipeHeader';
import { SwipeDots } from '@/components/swipe/SwipeDots';
import { SwipeEndSection } from '@/components/swipe/SwipeEndSection';
import { SwipeEmptyState } from '@/components/swipe/SwipeEmptyState';
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
  savedJobIds: Set<string>;
  onToggleSave: (jobId: string) => void;
  onClose: () => void;
  filterState?: SwipeFilterState;
}

/* ── Timing constants ────────────────────────────────────── */
const SCROLL_SNAP_DELAY = 90;
const END_BOUNCE_DELAY = 680;
const END_BOUNCE_HIDE_DELAY = 680;
const END_BOUNCE_TRIGGER_OFFSET = 12;
const END_STATE_HEIGHT = '100dvh';
const SNAP_REVEAL_OFFSET = 40;

export const SwipeFullscreen = memo(function SwipeFullscreen({
  jobs,
  appliedJobIds,
  savedJobIds,
  onToggleSave,
  onClose,
  filterState,
}: SwipeFullscreenProps) {
  /* ── Refs ─────────────────────────────────────────────── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const endSectionRef = useRef<HTMLDivElement | null>(null);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endBounceActiveRef = useRef(false);
  const currentIndexRef = useRef(0);
  const showEndBounceRef = useRef(false);
  const isReturningRef = useRef(false);
  const rafRef = useRef<number>(0);

  /* ── State ────────────────────────────────────────────── */
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [localAppliedIds, setLocalAppliedIds] = useState<Set<string>>(new Set());
  const [showEndBounce, setShowEndBounce] = useState(false);
  const [endStateVisible, setEndStateVisible] = useState(false);
  const [isReturningFromEnd, setIsReturningFromEnd] = useState(false);
  const [sectionHeight, setSectionHeight] = useState(END_STATE_HEIGHT);

  /* ── Keep refs in sync ────────────────────────────────── */
  currentIndexRef.current = currentIndex;
  showEndBounceRef.current = showEndBounce;
  isReturningRef.current = isReturningFromEnd;

  /* ── Derived values ───────────────────────────────────── */
  const currentJob = jobs[currentIndex];
  const isEndStateActive = endStateVisible || showEndBounce;
  const displayIndex = Math.min(currentIndex + 1, jobs.length);

  /* ── Helpers ──────────────────────────────────────────── */
  const isApplied = useCallback(
    (jobId: string) => appliedJobIds.has(jobId) || localAppliedIds.has(jobId),
    [appliedJobIds, localAppliedIds],
  );

  const clearTimers = useCallback(() => {
    if (scrollEndTimerRef.current) { clearTimeout(scrollEndTimerRef.current); scrollEndTimerRef.current = null; }
    if (bounceReturnTimerRef.current) { clearTimeout(bounceReturnTimerRef.current); bounceReturnTimerRef.current = null; }
    if (bounceHideTimerRef.current) { clearTimeout(bounceHideTimerRef.current); bounceHideTimerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
  }, []);

  const getScrollTop = useCallback((element: HTMLElement | null) => {
    const container = scrollRef.current;
    if (!container || !element) return null;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    return Math.min(Math.max(element.offsetTop, 0), maxScrollTop);
  }, []);

  const getSlideScrollTop = useCallback(
    (index: number) => getScrollTop(slideRefs.current[index] ?? null),
    [getScrollTop],
  );

  const getEndStateScrollTop = useCallback(
    () => getScrollTop(endSectionRef.current),
    [getScrollTop],
  );

  const scrollToSlide = useCallback((index: number) => {
    const container = scrollRef.current;
    const targetTop = getSlideScrollTop(index);
    if (!container || targetTop === null) return;
    container.scrollTo({ top: targetTop, behavior: 'smooth' });
  }, [getSlideScrollTop]);

  /** Scrubber: instant jump (no smooth scroll) for fast drag navigation */
  const handleScrubTo = useCallback((index: number) => {
    const container = scrollRef.current;
    const targetEl = slideRefs.current[index];
    if (!container || !targetEl) return;
    container.scrollTo({ top: targetEl.offsetTop, behavior: 'auto' });
    setCurrentIndex(index);
  }, []);

  /* ── End-of-stack bounce ──────────────────────────────── */
  const triggerEndBounce = useCallback(() => {
    if (jobs.length === 0 || showEndBounceRef.current || endBounceActiveRef.current) return;

    endBounceActiveRef.current = true;
    clearTimers();

    setIsReturningFromEnd(false);
    isReturningRef.current = false;
    setShowEndBounce(true);
    showEndBounceRef.current = true;
    setEndStateVisible(true);
    setCurrentIndex(jobs.length - 1);

    // Auto-return to last card after showing the message
    bounceReturnTimerRef.current = setTimeout(() => {
      setIsReturningFromEnd(true);
      isReturningRef.current = true;

      const lastIdx = jobs.length - 1;
      const container = scrollRef.current;
      const targetEl = slideRefs.current[lastIdx];
      if (container && targetEl) {
        container.scrollTo({ top: targetEl.offsetTop, behavior: 'smooth' });
      }

      bounceHideTimerRef.current = setTimeout(() => {
        setShowEndBounce(false);
        showEndBounceRef.current = false;
        setEndStateVisible(false);
        setIsReturningFromEnd(false);
        isReturningRef.current = false;
        endBounceActiveRef.current = false;
      }, END_BOUNCE_HIDE_DELAY);
    }, END_BOUNCE_DELAY);
  }, [clearTimers, jobs.length]);

  /* ── Scroll handler (RAF-throttled for 60fps) ─────────── */
  const handleScrollWithSnap = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container || showEndBounceRef.current || isReturningRef.current) return;

      const scrollTop = container.scrollTop;
      const endStateTop = getEndStateScrollTop();
      const hasReachedEndState = endStateTop !== null && scrollTop >= Math.max(0, endStateTop - SNAP_REVEAL_OFFSET);

      setEndStateVisible(hasReachedEndState);

      // Find closest slide
      let bestIdx = 0;
      let bestDist = Infinity;
      slideRefs.current.forEach((el, idx) => {
        if (!el) return;
        const slideTop = getScrollTop(el);
        if (slideTop === null) return;
        const dist = Math.abs(slideTop - scrollTop);
        if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
      });
      setCurrentIndex(prev => (prev !== bestIdx ? bestIdx : prev));

      // Debounced end-of-stack check
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);

      scrollEndTimerRef.current = setTimeout(() => {
        const st = scrollRef.current?.scrollTop;
        if (st == null || jobs.length === 0) return;

        const endTop = getEndStateScrollTop();
        const hasScrolledIntoEnd =
          currentIndexRef.current === jobs.length - 1 &&
          endTop !== null &&
          st >= endTop - END_BOUNCE_TRIGGER_OFFSET;

        if (hasScrolledIntoEnd) {
          triggerEndBounce();
        }

        scrollEndTimerRef.current = null;
      }, SCROLL_SNAP_DELAY);
    });
  }, [getEndStateScrollTop, getScrollTop, jobs.length, triggerEndBounce]);

  /* ── Effects ──────────────────────────────────────────── */
  useEffect(() => {
    setCurrentIndex(0);
    setShowEndBounce(false);
    setEndStateVisible(false);
    setIsReturningFromEnd(false);
    clearTimers();
    endBounceActiveRef.current = false;
    showEndBounceRef.current = false;
    isReturningRef.current = false;
    slideRefs.current = slideRefs.current.slice(0, jobs.length);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [jobs.length, clearTimers]);

  useEffect(() => () => { clearTimers(); }, [clearTimers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const viewport = window.visualViewport;

    const updateHeight = () => {
      setSectionHeight(`${Math.round(viewport?.height ?? window.innerHeight)}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    viewport?.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
      viewport?.removeEventListener('resize', updateHeight);
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScrollWithSnap, { passive: true });
    return () => container.removeEventListener('scroll', handleScrollWithSnap);
  }, [handleScrollWithSnap]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showDetail || showApply || showFilter) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showDetail, showApply, showFilter, onClose]);

  /* ── Stable callbacks ─────────────────────────────────── */
  const scrollToNext = useCallback(() => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < jobs.length) scrollToSlide(nextIdx);
  }, [currentIndex, jobs.length, scrollToSlide]);

  const handleSwipeRight = useCallback(() => { setShowApply(true); }, []);

  const handleSwipeLeft = useCallback(() => {
    if (currentIndex >= jobs.length - 1) return;
    scrollToNext();
  }, [currentIndex, jobs.length, scrollToNext]);

  const handleTap = useCallback(() => { setShowDetail(true); }, []);

  const handleApplyFromDetail = useCallback(() => {
    setShowDetail(false);
    setShowApply(true);
  }, []);

  const handleApplied = useCallback(() => {
    if (currentJob) {
      setLocalAppliedIds(prev => new Set(prev).add(currentJob.id));
    }
    setShowApply(false);
    if (currentIndex < jobs.length - 1) {
      setTimeout(scrollToNext, 300);
    }
  }, [currentIndex, currentJob, jobs.length, scrollToNext]);

  const handleCloseApply = useCallback(() => { setShowApply(false); }, []);
  const handleCloseDetail = useCallback(() => { setShowDetail(false); }, []);
  const handleFilterOpen = useCallback(() => { setShowFilter(true); }, []);
  const handleFilterClose = useCallback(() => { setShowFilter(false); }, []);

  // Stable ref setter
  const setSlideRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    slideRefs.current[idx] = el;
  }, []);

  /* ── Empty state (extracted) ──────────────────────────── */
  if (jobs.length === 0) {
    return createPortal(
      <>
        <SwipeEmptyState
          onClose={onClose}
          hasFilter={!!filterState}
          activeFilterCount={filterState?.activeFilterCount ?? 0}
          onFilterOpen={handleFilterOpen}
        />
        {filterState && (
          <SwipeFilterSheet
            open={showFilter}
            onClose={handleFilterClose}
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
      </>,
      document.body,
    );
  }

  /* ── Main render ──────────────────────────────────────── */
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9999] bg-parium-gradient"
      >
        <SwipeHeader
          displayIndex={displayIndex}
          totalCount={jobs.length}
          hasFilter={!!filterState}
          activeFilterCount={filterState?.activeFilterCount ?? 0}
          onFilterOpen={handleFilterOpen}
          onClose={onClose}
        />

        <SwipeDots
          count={jobs.length}
          currentIndex={currentIndex}
          isEndStateActive={isEndStateActive}
        />

        <div
          ref={scrollRef}
          className={`h-full w-full overflow-x-hidden overscroll-contain ${
            showDetail || showApply || showFilter ? 'overflow-y-hidden' : 'overflow-y-auto'
          } ${
            isReturningFromEnd ? 'snap-none' : 'snap-y snap-mandatory'
          }`}
          style={{
            WebkitOverflowScrolling: 'touch',
            willChange: 'scroll-position',
            contain: 'layout style paint',
            scrollPaddingTop: '0px',
            scrollBehavior: 'smooth',
          }}
        >
          {jobs.map((job, idx) => (
            <div
              key={job.id}
              ref={(el) => setSlideRef(el, idx)}
              data-index={idx}
              className="w-full shrink-0 snap-start snap-always"
              style={{
                minHeight: sectionHeight,
                height: sectionHeight,
                contain: 'layout style paint',
                willChange: 'auto',
              }}
            >
              <JobSlide
                job={job}
                applied={isApplied(job.id)}
                saved={savedJobIds.has(job.id)}
                isVisible={Math.abs(idx - currentIndex) <= 1}
                isLast={idx === jobs.length - 1}
                sectionHeight={sectionHeight}
                onSwipeRight={handleSwipeRight}
                onSwipeLeft={handleSwipeLeft}
                onSave={() => onToggleSave(job.id)}
                onTap={handleTap}
              />
            </div>
          ))}

          <SwipeEndSection
            ref={endSectionRef}
            sectionHeight={sectionHeight}
            showEndBounce={showEndBounce}
            endStateVisible={endStateVisible}
          />
        </div>

        {currentJob && showDetail && (
          <div className="fixed inset-0 z-[10000] pointer-events-none">
            <div className="relative w-full h-full pointer-events-auto">
              <SwipeJobDetail
                job={currentJob}
                open={showDetail}
                onClose={handleCloseDetail}
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
            onClose={handleFilterClose}
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
    document.body,
  );
});
