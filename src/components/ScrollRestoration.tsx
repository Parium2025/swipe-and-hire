import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import {
  getRestorableScrollContainer,
  readPositions,
  writePositions,
  getAnchorSnapshot,
  getAnchorDelta,
  clearScrollPosition,
  clearFooterNavigationForTarget,
  clearFooterRestoreForTarget,
  clearLatestFooterNavigationIfLeavingTarget,
  consumePendingFooterRestore,
  RESTORE_TOLERANCE_PX,
  SCROLL_HEIGHT_TOLERANCE_PX,
  MAX_WAIT_MS,
} from '@/lib/scrollRestoration';

const FORCE_TOP_ON_RELOAD_MS = 1200;
const isJobOverlayPath = (pathname: string) =>
  pathname.startsWith('/job-view/') || pathname.startsWith('/job/');

export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isRestoringRef = useRef(false);
  const pendingSaveFrameRef = useRef<number | null>(null);
  const isJobViewOverlayPath = isJobOverlayPath(location.pathname);
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    if (navigationType === 'PUSH' && previousPath !== location.pathname) {
      // 🛟 Säkerhetsnät: om användaren just öppnade en JobView-overlay från
      // en listvy (t.ex. /search-jobs → /job-view/:id) — snapshota föregående
      // sidas exakta scroll-position här också, som backup ifall kortets
      // pointerdown-hook missades (edge-swipe, snabb tap, inre child som
      // stoppar propagation osv.).
      const nowOverlay = isJobOverlayPath(location.pathname);
      const wasList = !isJobOverlayPath(previousPath);
      if (nowOverlay && wasList) {
        const container = getRestorableScrollContainer();
        if (container) {
          const positions = readPositions();
          const existing = positions[previousPath];
          // Skriv bara över om ny position skiljer sig — undvik att förstöra
          // en färskare pointerdown-snapshot med samma värde.
          const anchor = getAnchorSnapshot(container);
          positions[previousPath] = {
            top: container.scrollTop,
            anchorId: anchor?.anchorId ?? existing?.anchorId,
            anchorOffset: anchor?.anchorOffset ?? existing?.anchorOffset,
            scrollHeight: container.scrollHeight,
          };
          writePositions(positions);
        }
      }

      clearFooterRestoreForTarget(previousPath);
      clearLatestFooterNavigationIfLeavingTarget(previousPath);
    }
    previousPathRef.current = location.pathname;
  }, [location.pathname, navigationType]);


  // -----------------------------------------------------------------------
  // Save scroll position on user scroll
  // -----------------------------------------------------------------------
  useEffect(() => {
    // JobView är en overlay ovanpå den befintliga listan. Den får ALDRIG trigga
    // global restore/save mot huvudscrollen — annars hoppar bakgrundslistan till
    // toppen medan detaljsidan ligger ovanpå, vilket skapar blink/hack vid back.
    if (isJobViewOverlayPath) return;

    let scrollContainer = getRestorableScrollContainer();

    // If the container isn't in the DOM yet (e.g. layout still mounting),
    // poll briefly so we don't silently skip binding.
    if (!scrollContainer) {
      let retries = 0;
      const maxRetries = 10;
      const intervalId = setInterval(() => {
        scrollContainer = getRestorableScrollContainer();
        retries += 1;
        if (scrollContainer || retries >= maxRetries) {
          clearInterval(intervalId);
          if (scrollContainer) bind(scrollContainer);
        }
      }, 50);

      return () => clearInterval(intervalId);
    }

    return bind(scrollContainer);

    function bind(container: HTMLElement) {
      const savePosition = (requireCurrentPath = false) => {
        if (isRestoringRef.current) return;
        if (requireCurrentPath && window.location.pathname !== location.pathname) return;

        const positions = readPositions();
        const anchorSnapshot = getAnchorSnapshot(container);

        positions[location.pathname] = {
          top: container.scrollTop,
          anchorId: anchorSnapshot?.anchorId,
          anchorOffset: anchorSnapshot?.anchorOffset,
          scrollHeight: container.scrollHeight,
        };
        writePositions(positions);
      };

      const savePositionOnPageExit = () => savePosition(false);

      const handleScroll = () => {
        if (isRestoringRef.current) return;
        if (pendingSaveFrameRef.current) return;

        pendingSaveFrameRef.current = requestAnimationFrame(() => {
          pendingSaveFrameRef.current = null;
          savePosition(true);
        });
      };

      container.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('pagehide', savePositionOnPageExit);
      window.addEventListener('beforeunload', savePositionOnPageExit);

      return () => {
        container.removeEventListener('scroll', handleScroll);
        window.removeEventListener('pagehide', savePositionOnPageExit);
        window.removeEventListener('beforeunload', savePositionOnPageExit);
        if (pendingSaveFrameRef.current) {
          cancelAnimationFrame(pendingSaveFrameRef.current);
          pendingSaveFrameRef.current = null;
        }
        savePosition(true);
      };
    }
  }, [location.pathname, isJobViewOverlayPath]);

  // -----------------------------------------------------------------------
  // Restore scroll position on navigation
  // -----------------------------------------------------------------------
  const lastRestoredPathRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (isJobViewOverlayPath) return;

    // 🛟 Ignorera rena query-string-ändringar (t.ex. tab-byten via
    // setSearchParams). Pathname är oförändrad → användaren är kvar på
    // samma sida och scrollpositionen ska INTE nollställas.
    if (lastRestoredPathRef.current === location.pathname && navigationType !== 'POP') {
      return;
    }
    lastRestoredPathRef.current = location.pathname;


    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const documentNavigationType = navEntries[0]?.type;
    const isReload = documentNavigationType === 'reload';
    const isBackForwardDocument = documentNavigationType === 'back_forward';
    const isFreshDocumentEntry = location.key === 'default' && navigationType === 'POP' && !isBackForwardDocument;
    const isReturningFromJobOverlay = isJobOverlayPath(previousPathRef.current);
    // 🛟 Tillbaka från en footer-navigering (t.ex. /jobbsokare-footern → /jobb → back).
    // Historikens första entry har alltid key === 'default', vilket annars felaktigt
    // tolkas som "ny flik" och tvingar toppen. Har vi en färsk footer-snapshot för
    // den här sidan ska den istället återställas exakt där användaren klickade.
    const footerSnapshot = readPositions()[location.pathname];
    const isReturningFromFooterNavigation =
      navigationType === 'POP' &&
      footerSnapshot?.restoreSource === 'footer' &&
      typeof footerSnapshot.restoreSavedAt === 'number' &&
      Date.now() - footerSnapshot.restoreSavedAt < 30 * 60 * 1000;
    const shouldForceTop =
      isReload ||
      (isFreshDocumentEntry && !isReturningFromJobOverlay && !isReturningFromFooterNavigation);

    if (shouldForceTop) {
      clearScrollPosition(location.pathname);
      clearFooterNavigationForTarget(location.pathname);
    }

    const positions = readPositions();
    const shouldRestore = !shouldForceTop && (navigationType === 'POP' || consumePendingFooterRestore(location.pathname));
    const storedPosition = shouldRestore ? positions[location.pathname] : undefined;
    const targetTop = storedPosition?.top ?? 0;

    let cancelled = false;
    let rafId = 0;

    const releaseRestoreLock = () => {
      // Use a microtask instead of rAF so the lock is released deterministically
      // even if the component unmounts immediately after (fixing the race condition).
      Promise.resolve().then(() => {
        if (!cancelled) {
          isRestoringRef.current = false;
        }
      });
    };

    isRestoringRef.current = true;

    // For scroll-to-top (targetTop === 0) we can apply immediately.
    // Undantag: när användaren går tillbaka från JobView-overlay utan sparad
    // snapshot ska vi låta den underliggande KeepAlive-listan behålla sin
    // nuvarande position — annars hamnar man högst upp i jobbsöklistan.
    const shouldApplyTop = targetTop === 0 && !isReturningFromJobOverlay;
    if (targetTop === 0 && !shouldApplyTop) {
      releaseRestoreLock();
      return;
    }

    if (targetTop === 0) {
      const startTime = performance.now();
      let topFrame = 0;
      let userInterrupted = false;
      let boundContainer: HTMLElement | null = null;

      const applyTop = () => {
        const scrollContainer = getRestorableScrollContainer();
        if (!scrollContainer) return;
        if (boundContainer !== scrollContainer) {
          boundContainer?.removeEventListener('touchstart', handleUserGesture);
          boundContainer?.removeEventListener('wheel', handleUserGesture);
          boundContainer?.removeEventListener('pointerdown', handleUserGesture);
          boundContainer = scrollContainer;
          scrollContainer.addEventListener('touchstart', handleUserGesture, { passive: true });
          scrollContainer.addEventListener('wheel', handleUserGesture, { passive: true });
          scrollContainer.addEventListener('pointerdown', handleUserGesture, { passive: true });
        }
        const previousBehavior = scrollContainer.style.scrollBehavior;
        scrollContainer.style.scrollBehavior = 'auto';
        scrollContainer.scrollTop = 0;
        scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        scrollContainer.style.scrollBehavior = previousBehavior;
      };

      function cleanupTop() {
        if (topFrame) cancelAnimationFrame(topFrame);
        boundContainer?.removeEventListener('touchstart', handleUserGesture);
        boundContainer?.removeEventListener('wheel', handleUserGesture);
        boundContainer?.removeEventListener('pointerdown', handleUserGesture);
        boundContainer = null;
      }

      function finishTop() {
        cleanupTop();
        releaseRestoreLock();
      }

      function handleUserGesture() {
        userInterrupted = true;
        cancelled = true;
        finishTop();
      }

      const enforceTop = () => {
        if (cancelled || userInterrupted) return;
        isRestoringRef.current = true;
        applyTop();

        // Hard reloads can re-apply native scroll restoration to overflow
        // containers *after* React layout effects. Keep the top position locked
        // briefly so footer-origin reloads cannot land at the old footer/list.
        if (shouldForceTop && performance.now() - startTime < FORCE_TOP_ON_RELOAD_MS) {
          topFrame = requestAnimationFrame(enforceTop);
          return;
        }

        finishTop();
      };

      enforceTop();

      return () => {
        cancelled = true;
        cleanupTop();
      };
    }

    // For saved positions: wait until the target anchor/height exists, then do
    // ONE instant scroll. No observers, no smooth behavior, no repeated scrollTo
    // loop that can fight touch input or image decoding while the user scrolls.
    const startTime = performance.now();
    let userInterrupted = false;
    let restored = false;
    let boundContainer: HTMLElement | null = null;

    const detachGestureListeners = () => {
      if (!boundContainer) return;
      boundContainer.removeEventListener('touchstart', handleUserGesture);
      boundContainer.removeEventListener('wheel', handleUserGesture);
      boundContainer.removeEventListener('pointerdown', handleUserGesture);
      boundContainer = null;
    };

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      detachGestureListeners();
    };

    const finish = () => {
      cleanup();
      releaseRestoreLock();
    };

    function handleUserGesture() {
      userInterrupted = true;
      cancelled = true;
      finish();
    }

    const attachGestureListeners = (container: HTMLElement) => {
      if (boundContainer === container) return;
      detachGestureListeners();
      boundContainer = container;
      container.addEventListener('touchstart', handleUserGesture, { passive: true });
      container.addEventListener('wheel', handleUserGesture, { passive: true });
      container.addEventListener('pointerdown', handleUserGesture, { passive: true });
    };

    const attemptRestore = (): boolean => {
      if (cancelled || userInterrupted || restored) return restored;

      const scrollContainer = getRestorableScrollContainer();
      if (!scrollContainer) return false;

      attachGestureListeners(scrollContainer);

      const anchorDelta = getAnchorDelta(
        scrollContainer,
        storedPosition?.anchorId,
        storedPosition?.anchorOffset,
      );

      // Check height-readiness BEFORE scrolling so we don't clamp-to-0 when the
      // list is still empty or fewer cards have rendered than the clicked card.
      const heightReady = !storedPosition?.scrollHeight
        || scrollContainer.scrollHeight >= storedPosition.scrollHeight - SCROLL_HEIGHT_TOLERANCE_PX;
      const targetTopReady = scrollContainer.scrollHeight - scrollContainer.clientHeight >= targetTop - SCROLL_HEIGHT_TOLERANCE_PX;

      if (anchorDelta === null && !heightReady && !targetTopReady) {
        return false;
      }

      isRestoringRef.current = true;
      // Om sidan har exakt samma höjd som när positionen sparades är layouten
      // identisk — då är den absoluta positionen alltid mest korrekt. Ankaret
      // kan ha flyttats av pinnade/animerade sektioner och ge fel offset.
      const layoutIdentical = typeof storedPosition?.scrollHeight === 'number'
        && Math.abs(scrollContainer.scrollHeight - storedPosition.scrollHeight) <= RESTORE_TOLERANCE_PX;
      const previousBehavior = scrollContainer.style.scrollBehavior;
      scrollContainer.style.scrollBehavior = 'auto';
      if (anchorDelta !== null && !layoutIdentical) {
        scrollContainer.scrollTop = scrollContainer.scrollTop + anchorDelta;
      } else {
        scrollContainer.scrollTop = targetTop;
      }
      scrollContainer.style.scrollBehavior = previousBehavior;

      const verifyDelta = getAnchorDelta(
        scrollContainer,
        storedPosition?.anchorId,
        storedPosition?.anchorOffset,
      );
      const closeEnough = (verifyDelta !== null && !layoutIdentical)
        ? Math.abs(verifyDelta) <= RESTORE_TOLERANCE_PX
        : Math.abs(scrollContainer.scrollTop - targetTop) <= RESTORE_TOLERANCE_PX;

      if (closeEnough) {
        restored = true;
        holdPosition(scrollContainer);
        return true;
      }

      return false;
    };

    // 🛟 Efter första lyckade återställningen kan sidhöjden fortfarande krympa
    // (lazy-sektioner, videos, pinnade gallerier som settlar). Webbläsarens
    // scroll-anchoring drar då iväg positionen. Vi håller kvar exakt läge en
    // kort stund tills höjden är stabil — men släpper direkt vid touch/scroll.
    const HOLD_MS = 1200;
    function holdPosition(container: HTMLElement) {
      const holdStart = performance.now();
      const tick = () => {
        if (cancelled || userInterrupted) return;
        const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const desired = Math.min(targetTop, maxTop);
        if (Math.abs(container.scrollTop - desired) > RESTORE_TOLERANCE_PX) {
          const previous = container.style.scrollBehavior;
          container.style.scrollBehavior = 'auto';
          container.scrollTop = desired;
          container.style.scrollBehavior = previous;
        }
        if (performance.now() - holdStart < HOLD_MS) {
          rafId = requestAnimationFrame(tick);
          return;
        }
        finish();
      };
      rafId = requestAnimationFrame(tick);
    }

    const scheduleRetry = () => {
      if (cancelled || userInterrupted || restored) return;
      if (performance.now() - startTime >= MAX_WAIT_MS) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (attemptRestore()) return;
        scheduleRetry();
      });
    };

    // Initial attempt — wait one frame so the new route has mounted.
    rafId = requestAnimationFrame(() => {
      if (cancelled || userInterrupted) return;
      if (attemptRestore()) return;
      scheduleRetry();
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [location.pathname, location.key, navigationType, isJobViewOverlayPath]);

  // -----------------------------------------------------------------------
  // Disable native scroll restoration
  // -----------------------------------------------------------------------
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return null;
}
