import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';

import { JobSlide } from '@/components/swipe/JobSlide';
import { SwipeJobDetail } from '@/components/swipe/SwipeJobDetail';
import { SwipeApplySheet } from '@/components/swipe/SwipeApplySheet';
import { SwipeFilterSheet } from '@/components/swipe/SwipeFilterSheet';
import { SwipeHeader } from '@/components/swipe/SwipeHeader';
import { SwipeDots } from '@/components/swipe/SwipeDots';
import { SwipeEndSection } from '@/components/swipe/SwipeEndSection';
import { SwipeEmptyState } from '@/components/swipe/SwipeEmptyState';
import { useSwipeImagePreloader } from '@/hooks/useSwipeImagePreloader';
import { useSwipeUndo } from '@/components/swipe/hooks/useSwipeUndo';
import { useOverlayCooldown } from '@/components/swipe/hooks/useOverlayCooldown';
import { SwipeActionsBar } from '@/components/swipe/SwipeActionsBar';
import type { SwipeJob } from '@/components/swipe/types';

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
  skippedJobIds?: Set<string>;
  onRecordSwipeAction?: (jobId: string, action: 'skipped' | 'liked' | 'applied') => void;
  onUndoSwipeAction?: (jobId: string) => void;
  /** Anropas när användaren närmar sig slutet av stacken — laddar nästa sida. */
  onNeedMore?: () => void;
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
  skippedJobIds,
  onRecordSwipeAction,
  onUndoSwipeAction,
  onNeedMore,
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
  // 🛡️ Under array-mutation (skip / undo) hoppar endSection sin offsetTop
  // uppåt/nedåt medan scrollTop står stilla. Innan effekt-scrollen hunnit
  // återsnappa aktivt kort kan scroll-handlern läsa scrollTop >= nya endTop
  // och blinka "Inga fler jobb" i en frame mellan korten. Suppresa
  // end-check i några frames efter varje jobs-ändring.
  const suppressEndCheckRef = useRef(false);
  const suppressEndCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 🖐️ Track active touch on scroll container. Snap-recovery / end-bounce
  // får ALDRIG köra `scrollTo({behavior:'smooth'})` medan användarens finger
  // ligger kvar — då slåss iOS scroll-engine med vår kod och kortet skakar.
  const isTouchingRef = useRef(false);

  /* ── Session persistence ───────────────────────────────── */
  const SWIPE_INDEX_KEY = 'parium-swipe-index';

  const getRestoredIndex = useCallback(() => {
    try {
      const saved = sessionStorage.getItem(SWIPE_INDEX_KEY);
      if (saved === null) return 0;
      const idx = parseInt(saved, 10);
      return Number.isFinite(idx) && idx >= 0 ? idx : 0;
    } catch { return 0; }
  }, []);

  /* ── State ────────────────────────────────────────────── */
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [localAppliedIds, setLocalAppliedIds] = useState<Set<string>>(new Set());
  const [skipEntryAnimationForId, setSkipEntryAnimationForId] = useState<string | null>(null);
  const [showEndBounce, setShowEndBounce] = useState(false);
  const [endStateVisible, setEndStateVisible] = useState(false);
  const [isReturningFromEnd, setIsReturningFromEnd] = useState(false);
  const [sectionHeight, setSectionHeight] = useState(END_STATE_HEIGHT);

  /* ── Undo (isolerad hook) ─────────────────────────────── */
  const {
    canUndo,
    undoEntryJobId,
    consumePendingUndo,
    pushSkipped,
    handleUndo,
  } = useSwipeUndo({ onUndoSwipeAction });

  /* ── Overlay-cooldown (isolerad hook) ─────────────────── */
  const {
    shieldActive: overlayInteractionShieldActive,
    startCooldown: startOverlayCooldown,
    isInCooldown,
  } = useOverlayCooldown(520);

  /* ── Persistent action-bar: ref till aktivt korts swipe-API ────
   * Bar-knapparna (✕ / ❤) triggar den aktiva JobSlidens `triggerSwipe`
   * — samma animation som en manuell swipe. Ref används istället för
   * state så baren står stilla utan re-render vid varje kortbyte.
   */
  const activeCardSwipeRef = useRef<((direction: 'left' | 'right') => void) | null>(null);
  const registerActiveSwipeApi = useCallback(
    (api: { swipe: (d: 'left' | 'right') => void } | null) => {
      activeCardSwipeRef.current = api?.swipe ?? null;
    },
    [],
  );

  /* ── Premium image preloading: 10 ahead, 2 back, bulk-25 on mount ── */
  useSwipeImagePreloader(jobs, currentIndex, 10, 2, 25);

  /* ── Clear persisted index on unmount (reset on re-entry) ── */
  useEffect(() => {
    return () => {
      try { sessionStorage.removeItem(SWIPE_INDEX_KEY); } catch {}
    };
  }, []);

  /* ── Keep refs in sync ────────────────────────────────── */
  currentIndexRef.current = currentIndex;
  showEndBounceRef.current = showEndBounce;
  isReturningRef.current = isReturningFromEnd;

  /* ── Derived values ───────────────────────────────────── */
  const currentJob = jobs[currentIndex];
  const isEndStateActive = endStateVisible || showEndBounce;
  const displayIndex = Math.min(currentIndex + 1, jobs.length);

  /* ── Infinite stack: hämta nästa sida innan korten tar slut ──
     Utan detta stannar swipe-stacken på första sidan (100 jobb) även
     om databasen har 100 000 träffar. */
  useEffect(() => {
    if (!onNeedMore) return;
    // jobs.length === 0 kan betyda att hela sidan filtrerats bort (redan
    // svepta/sökta jobb) — då måste vi fortsätta hämta, inte visa "slut".
    if (jobs.length === 0 || currentIndex >= jobs.length - 8) onNeedMore();
  }, [currentIndex, jobs.length, onNeedMore]);


  /* ── Stabila callbacks för persistent action-bar ─────────
   * Utan dessa skapades onSave/onDislike/onLike som inline-arrows i JSX
   * varje render → memo(SwipeActionsBar) blev värdelös → knapparna
   * "reload:ades" visuellt varje gång currentIndex/undo-state ändrades.
   * Ref-baserad currentJob-lookup gör att baren aldrig behöver re-renderas
   * när kort byts eller Ångra trycks.
   */
  const currentJobRef = useRef(currentJob);
  currentJobRef.current = currentJob;
  const onToggleSaveRef = useRef(onToggleSave);
  onToggleSaveRef.current = onToggleSave;

  const barOnSave = useCallback(() => {
    const job = currentJobRef.current;
    if (job) onToggleSaveRef.current(job.id);
  }, []);
  const barOnDislike = useCallback(() => {
    activeCardSwipeRef.current?.('left');
  }, []);
  const barOnLike = useCallback(() => {
    activeCardSwipeRef.current?.('right');
  }, []);

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

      // Find closest slide FIRST — end-state check måste veta om vi verkligen
      // står på sista kortet, annars kan endSection blinka mitt i stacken när
      // ett kort skippas och layout krymper (endSection flyttas upp).
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

      const atLastSlide = jobs.length > 0 && bestIdx === jobs.length - 1;
      const endStateTop = getEndStateScrollTop();
      const hasReachedEndState =
        !suppressEndCheckRef.current &&
        atLastSlide &&
        endStateTop !== null &&
        scrollTop >= Math.max(0, endStateTop - SNAP_REVEAL_OFFSET);

      setEndStateVisible(hasReachedEndState);

      // Debounced end-of-stack check
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);

      scrollEndTimerRef.current = setTimeout(() => {
        const container = scrollRef.current;
        const st = container?.scrollTop;
        if (st == null || jobs.length === 0) return;
        if (suppressEndCheckRef.current) return;
        // 🖐️ Skip helt medan fingret ligger kvar — snap-recovery och
        // end-bounce körs istället i touchend-handlern nedan.
        if (isTouchingRef.current) return;

        const endTop = getEndStateScrollTop();
        const hasScrolledIntoEnd =
          currentIndexRef.current === jobs.length - 1 &&
          endTop !== null &&
          st >= endTop - END_BOUNCE_TRIGGER_OFFSET;

        if (hasScrolledIntoEnd) {
          triggerEndBounce();
        } else {
          // Snap recovery: iOS Safari occasionally lets users settle between
          // slides despite snap-mandatory. Force-align to the nearest slide.
          const nearestEl = slideRefs.current[currentIndexRef.current];
          if (container && nearestEl) {
            const targetTop = nearestEl.offsetTop;
            if (Math.abs(targetTop - st) > 2) {
              container.scrollTo({ top: targetTop, behavior: 'smooth' });
            }
          }
        }

        scrollEndTimerRef.current = null;
      }, SCROLL_SNAP_DELAY);
    });
  }, [getEndStateScrollTop, getScrollTop, jobs.length, triggerEndBounce]);

  /* ── Effects ──────────────────────────────────────────── */
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    setShowEndBounce(false);
    setEndStateVisible(false);
    setIsReturningFromEnd(false);
    clearTimers();
    endBounceActiveRef.current = false;
    showEndBounceRef.current = false;
    isReturningRef.current = false;
    slideRefs.current = slideRefs.current.slice(0, jobs.length);

    // 🛡️ Suppresa end-state-check under transitionen. När ett kort skippas
    // krymper container-höjden → endSection åker uppåt. Utan denna gate
    // hinner scroll-handlern läsa "vid slutet" i en enda frame och blinka
    // "Inga fler jobb"-kortet mellan aktiva och nästa kort.
    suppressEndCheckRef.current = true;
    if (suppressEndCheckTimerRef.current) clearTimeout(suppressEndCheckTimerRef.current);
    suppressEndCheckTimerRef.current = setTimeout(() => {
      suppressEndCheckRef.current = false;
      suppressEndCheckTimerRef.current = null;
    }, 260);

    if (!hasRestoredRef.current && jobs.length > 0) {
      hasRestoredRef.current = true;
      const restored = getRestoredIndex();
      const safeIdx = Math.min(restored, jobs.length - 1);
      setCurrentIndex(safeIdx);
      requestAnimationFrame(() => {
        const el = slideRefs.current[safeIdx];
        if (el && scrollRef.current) {
          scrollRef.current.scrollTo({ top: el.offsetTop, behavior: 'auto' });
        }
      });
    } else if (hasRestoredRef.current && jobs.length > 0) {
      // When jobs change (skip removes / undo re-inserts), pick the right target.
      setCurrentIndex(prev => {
        // 🎯 If an undo just happened, jump explicitly to the restored job's
        // new position in the array — don't rely on clamping `prev`, which
        // would leave the user on whatever card now occupies the old index.
        let target = prev;
        const pendingId = consumePendingUndo();
        if (pendingId) {
          const restoredIdx = jobs.findIndex(j => j.id === pendingId);
          if (restoredIdx >= 0) target = restoredIdx;
        }
        const clamped = Math.min(Math.max(target, 0), jobs.length - 1);
        // Snap to the correct slide position (instant, no smooth — avoids
        // iOS Safari fighting the snap engine after array mutation).
        requestAnimationFrame(() => {
          const el = slideRefs.current[clamped];
          if (el && scrollRef.current) {
            scrollRef.current.scrollTo({ top: el.offsetTop, behavior: 'auto' });
          }
        });
        return clamped;
      });
    }
  }, [jobs, clearTimers, getRestoredIndex]);

  useEffect(() => () => {
    clearTimers();
    if (suppressEndCheckTimerRef.current) {
      clearTimeout(suppressEndCheckTimerRef.current);
      suppressEndCheckTimerRef.current = null;
    }
  }, [clearTimers]);

  // 🛟 KRITISKT: Använd 100svh (small viewport height) istället för
  // visualViewport.height. På iOS Safari krymper visualViewport när URL-baren
  // visas/döljs → sectionHeight fluktuerade → kort "krympte" mitt i sessionen
  // och två kort fick plats i frame samtidigt. `svh` är alltid den minsta
  // stabila viewporten (URL-bar synlig) och ändras ALDRIG under scroll.
  // Vi uppdaterar bara vid orientationchange så snap-punkterna är exakta.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateHeight = () => {
      // Mät faktisk pixelhöjd av 100svh via ett dolt element så snap-scroll
      // får en exakt px-siffra (CSS-strängen "100svh" skulle också fungera
      // men snap-matte blir stabilare med px).
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;pointer-events:none;visibility:hidden;';
      document.body.appendChild(probe);
      const px = probe.getBoundingClientRect().height || window.innerHeight;
      document.body.removeChild(probe);
      setSectionHeight(`${Math.round(px)}px`);
    };

    updateHeight();
    // Endast orientationchange — INTE resize eller visualViewport, eftersom
    // Safaris URL-bar triggar resize-events som skulle krympa korten igen.
    window.addEventListener('orientationchange', updateHeight);
    return () => {
      window.removeEventListener('orientationchange', updateHeight);
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScrollWithSnap, { passive: true });

    // 🖐️ Håll koll på om fingret ligger kvar på scrollcontainern.
    // Under en pågående touch får snap-recovery / end-bounce INTE köra
    // `scrollTo({behavior:'smooth'})` — det skakar mot iOS scroll-engine.
    const onTouchStart = () => {
      isTouchingRef.current = true;
    };
    const onTouchEnd = () => {
      isTouchingRef.current = false;
      // När fingret släpps: kör en snap-check kort efter så vi landar på
      // närmaste kort även om timern hoppade över under touchen.
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = setTimeout(() => {
        scrollEndTimerRef.current = null;
        const c = scrollRef.current;
        if (!c || jobs.length === 0) return;
        if (suppressEndCheckRef.current) return;
        if (isTouchingRef.current) return;

        const st = c.scrollTop;
        const endTop = getEndStateScrollTop();
        const hasScrolledIntoEnd =
          currentIndexRef.current === jobs.length - 1 &&
          endTop !== null &&
          st >= endTop - END_BOUNCE_TRIGGER_OFFSET;

        if (hasScrolledIntoEnd) {
          triggerEndBounce();
          return;
        }
        const nearestEl = slideRefs.current[currentIndexRef.current];
        if (nearestEl) {
          const targetTop = nearestEl.offsetTop;
          if (Math.abs(targetTop - st) > 2) {
            c.scrollTo({ top: targetTop, behavior: 'smooth' });
          }
        }
      }, SCROLL_SNAP_DELAY);
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScrollWithSnap);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [handleScrollWithSnap, getEndStateScrollTop, jobs.length, triggerEndBounce]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (skipEntryAnimationForId && currentJob?.id === skipEntryAnimationForId) {
      setSkipEntryAnimationForId(null);
    }
  }, [currentJob?.id, skipEntryAnimationForId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showDetail || showApply || showFilter) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // ♿ a11y: piltangenter för like/skip när inga overlays är öppna.
      // Gör swipe-mode användbar med tangentbord / switch-access.
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSwipeRightRef.current?.();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSwipeLeftRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showDetail, showApply, showFilter, onClose]);

  /* ── Stable callbacks ─────────────────────────────────── */
  const scrollToNext = useCallback(() => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < jobs.length) scrollToSlide(nextIdx);
  }, [currentIndex, jobs.length, scrollToSlide]);

  const handleSwipeRight = useCallback(() => {
    if (!currentJob) return;
    // 🛑 Om jobbet redan är sökt → öppna inte ansökningssheet igen.
    // Tidigare slide-in-animation varje gång användaren råkade dra höger
    // på ett "SÖKT"-kort upplevdes störande. Nu är högerswipe en no-op.
    if (isApplied(currentJob.id)) return;
    onRecordSwipeAction?.(currentJob.id, 'liked');
    // 👉 Höger-swipe visar full jobbinfo direkt (tidigare "Snabb info").
    // Ansökan startas därifrån via CTA:n i botten av detaljvyn.
    setShowDetail(true);
  }, [currentJob, isApplied, onRecordSwipeAction]);

  const handleSwipeLeft = useCallback(() => {
    const skippedJob = jobs[currentIndex];
    if (!skippedJob) return;
    setSkipEntryAnimationForId(jobs[currentIndex + 1]?.id ?? null);

    // Record skip action – the job will be removed from the array by the parent
    onRecordSwipeAction?.(skippedJob.id, 'skipped');

    // Undo-hookens LIFO-push (ref-baserad, ingen re-render).
    pushSkipped(skippedJob.id);
  }, [currentIndex, jobs, onRecordSwipeAction, pushSkipped]);

  // ♿ Refs så keyboard-handlern alltid kallar senaste callbacken utan att
  // re-binda window.keydown vid varje state-ändring (currentIndex etc).
  const handleSwipeRightRef = useRef(handleSwipeRight);
  const handleSwipeLeftRef = useRef(handleSwipeLeft);
  useEffect(() => { handleSwipeRightRef.current = handleSwipeRight; }, [handleSwipeRight]);
  useEffect(() => { handleSwipeLeftRef.current = handleSwipeLeft; }, [handleSwipeLeft]);

  const handleApplyFromDetail = useCallback(() => {
    setShowDetail(false);
    setShowApply(true);
  }, []);

  const handleApplied = useCallback(() => {
    if (currentJob) {
      setLocalAppliedIds(prev => new Set(prev).add(currentJob.id));
      onRecordSwipeAction?.(currentJob.id, 'applied');
    }
    setShowApply(false);
    // Stay on the card so user sees the "SÖKT" stamp
  }, [currentJob, onRecordSwipeAction]);

  const handleCloseApply = useCallback(() => { setShowApply(false); startOverlayCooldown(); }, [startOverlayCooldown]);
  const handleCloseDetail = useCallback(() => { setShowDetail(false); startOverlayCooldown(); }, [startOverlayCooldown]);
  const handleFilterOpen = useCallback(() => { setShowFilter(true); }, []);
  const handleFilterClose = useCallback(() => { setShowFilter(false); startOverlayCooldown(); }, [startOverlayCooldown]);

  // Stable ref setter
  const setSlideRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    slideRefs.current[idx] = el;
  }, []);

  /* ── Delade fragment (för att undvika duplicering mellan empty / main) ── */
  const filterSheetElement = filterState ? (
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
  ) : null;

  /* ── Empty state (behåller sin egen render-väg för att inte påverka UX) ── */
  if (jobs.length === 0) {
    return createPortal(
      <>
        <SwipeEmptyState
          onClose={onClose}
          hasFilter={!!filterState}
          activeFilterCount={filterState?.activeFilterCount ?? 0}
          onFilterOpen={handleFilterOpen}
          canUndo={canUndo}
          onUndo={handleUndo}
        />
        {filterSheetElement}
      </>,
      document.body,
    );
  }

  /* ── Main render ──────────────────────────────────────── */
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-parium-gradient">

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
          onScrubTo={handleScrubTo}
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
          {jobs.map((job, idx) => {
            // 🚀 Virtualisering: mounta bara full JobSlide när kortet är
            // inom ±2 av aktivt. Snap-mandatory gör att man aldrig ser mer
            // än ~1 kort i taget under scroll, så placeholder-tomrum för
            // långt bort-liggande kort märks ALDRIG visuellt. Vinsten:
            // upp till 25 kort × (4 useCardImage + 6 motion values +
            // decode-effekter + gesture-hook) monteras inte alls → snabb
            // vertikal swipe har inga tunga re-renders att slåss mot.
            const withinWindow = Math.abs(idx - currentIndex) <= 2;
            return (
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
                {withinWindow ? (
                  <JobSlide
                    job={job}
                    nextJob={idx === currentIndex ? jobs[idx + 1] : undefined}
                    applied={isApplied(job.id)}
                    saved={savedJobIds.has(job.id)}
                    skipped={skippedJobIds?.has(job.id) ?? false}
                    isVisible={Math.abs(idx - currentIndex) <= 1}
                    isActive={idx === currentIndex}
                    isLast={idx === jobs.length - 1}
                    sectionHeight={sectionHeight}
                    overlayOpen={showDetail || showApply || showFilter}
                    skipEntryAnimation={job.id === skipEntryAnimationForId}
                    isUndoEntry={job.id === undoEntryJobId}
                    onSwipeRight={handleSwipeRight}
                    onSwipeLeft={handleSwipeLeft}
                    onSave={() => onToggleSave(job.id)}
                    onRegisterSwipeApi={registerActiveSwipeApi}
                  />
                ) : null}
              </div>
            );
          })}

          <SwipeEndSection
            ref={endSectionRef}
            sectionHeight={sectionHeight}
            showEndBounce={showEndBounce}
            endStateVisible={endStateVisible}
          />
        </div>

        {/* Persistent action-bar: står stilla mellan kort så att t.ex.
            Ångra-knappen är på plats i samma sekund som ett kort nekas. */}
        <SwipeActionsBar
          saved={currentJob ? savedJobIds.has(currentJob.id) : false}
          canUndo={canUndo}
          visible={!isEndStateActive}
          onUndo={handleUndo}
          onSave={barOnSave}
          onDislike={barOnDislike}
          onLike={barOnLike}
        />


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

        {currentJob && (
          <div className={`fixed inset-0 z-[10001] ${showApply ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <SwipeApplySheet
              jobId={currentJob.id}
              jobTitle={currentJob.title}
              companyName={currentJob.company_name}
              job={currentJob}
              open={showApply}
              onClose={handleCloseApply}
              onApplied={handleApplied}
            />
          </div>
        )}

        {filterSheetElement}

        {overlayInteractionShieldActive && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[10002] pointer-events-auto"
          />
        )}
      </div>,
    document.body,
  );

});
