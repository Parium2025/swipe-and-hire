import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import {
  getManagedScrollContainer,
  readPositions,
  writePositions,
  getAnchorSnapshot,
  getAnchorDelta,
  RESTORE_TOLERANCE_PX,
  REQUIRED_STABLE_FRAMES,
  SCROLL_HEIGHT_TOLERANCE_PX,
  MAX_WAIT_MS,
} from '@/lib/scrollRestoration';

export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isRestoringRef = useRef(false);
  const pendingSaveFrameRef = useRef<number | null>(null);

  // -----------------------------------------------------------------------
  // Save scroll position on user scroll
  // -----------------------------------------------------------------------
  useEffect(() => {
    let scrollContainer = getManagedScrollContainer();

    // If the container isn't in the DOM yet (e.g. layout still mounting),
    // poll briefly so we don't silently skip binding.
    if (!scrollContainer) {
      let retries = 0;
      const maxRetries = 10;
      const intervalId = setInterval(() => {
        scrollContainer = getManagedScrollContainer();
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
      const handleScroll = () => {
        if (isRestoringRef.current) return;
        if (pendingSaveFrameRef.current) return;

        pendingSaveFrameRef.current = requestAnimationFrame(() => {
          pendingSaveFrameRef.current = null;
          if (isRestoringRef.current) return;

          const positions = readPositions();
          const anchorSnapshot = getAnchorSnapshot(container);

          positions[location.pathname] = {
            top: container.scrollTop,
            anchorId: anchorSnapshot?.anchorId,
            anchorOffset: anchorSnapshot?.anchorOffset,
            scrollHeight: container.scrollHeight,
          };
          writePositions(positions);
        });
      };

      container.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (pendingSaveFrameRef.current) {
          cancelAnimationFrame(pendingSaveFrameRef.current);
          pendingSaveFrameRef.current = null;
        }
      };
    }
  }, [location.pathname]);

  // -----------------------------------------------------------------------
  // Restore scroll position on navigation
  // -----------------------------------------------------------------------
  useLayoutEffect(() => {
    const positions = readPositions();
    const storedPosition = navigationType === 'POP' ? positions[location.pathname] : undefined;
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

    // For scroll-to-top (targetTop === 0) we can apply immediately
    if (targetTop === 0) {
      const scrollContainer = getManagedScrollContainer();
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
      }
      releaseRestoreLock();

      return () => {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
      };
    }

    // For restoring a saved position we use an EVENT-DRIVEN approach instead
    // of hammering scrollTo() every frame:
    //   1. Try once immediately.
    //   2. If content isn't tall enough / anchor missing → observe the DOM
    //      (MutationObserver + ResizeObserver) and re-try only when something
    //      actually changes.
    //   3. ANY user gesture aborts immediately and we never snap again.
    //
    // This eliminates two bugs:
    //   - First-visit "lands at top": old loop kept clamping to 0 while DOM
    //     was empty; user touched the empty page → gesture cancelled before
    //     content loaded → stuck at top. Now we wait passively for content.
    //   - "Jump/blink when scrolling after back": old loop's scrollTo() ran
    //     in the same frame as the user's finger → fight → snap-back. Now
    //     we never call scrollTo() after the user has touched the screen.
    const startTime = performance.now();
    let userInterrupted = false;
    let restored = false;
    let boundContainer: HTMLElement | null = null;
    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let timeoutId: number | null = null;
    let retryRafId = 0;

    const detachGestureListeners = () => {
      if (!boundContainer) return;
      boundContainer.removeEventListener('touchstart', handleUserGesture);
      boundContainer.removeEventListener('wheel', handleUserGesture);
      boundContainer.removeEventListener('pointerdown', handleUserGesture);
      boundContainer = null;
    };

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (retryRafId) cancelAnimationFrame(retryRafId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      mutationObserver = null;
      resizeObserver = null;
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

      const scrollContainer = getManagedScrollContainer();
      if (!scrollContainer) return false;

      attachGestureListeners(scrollContainer);

      const anchorDelta = getAnchorDelta(
        scrollContainer,
        storedPosition?.anchorId,
        storedPosition?.anchorOffset,
      );

      // Check height-readiness BEFORE scrolling so we don't clamp-to-0
      // when the list is still empty.
      const heightReady = !storedPosition?.scrollHeight
        || scrollContainer.scrollHeight >= storedPosition.scrollHeight - SCROLL_HEIGHT_TOLERANCE_PX;

      if (anchorDelta === null && !heightReady) {
        // Content not ready — wait for DOM/size to change instead of
        // hammering scrollTo every frame.
        return false;
      }

      if (anchorDelta !== null) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollTop + anchorDelta, behavior: 'auto' });
      } else {
        scrollContainer.scrollTo({ top: targetTop, behavior: 'auto' });
      }

      const verifyDelta = getAnchorDelta(
        scrollContainer,
        storedPosition?.anchorId,
        storedPosition?.anchorOffset,
      );
      const closeEnough = verifyDelta !== null
        ? Math.abs(verifyDelta) <= RESTORE_TOLERANCE_PX
        : Math.abs(scrollContainer.scrollTop - targetTop) <= RESTORE_TOLERANCE_PX;

      if (closeEnough) {
        restored = true;
        finish();
        return true;
      }

      return false;
    };

    const scheduleRetry = () => {
      if (cancelled || userInterrupted || restored) return;
      if (retryRafId) return; // coalesce a burst of mutations into one rAF
      retryRafId = requestAnimationFrame(() => {
        retryRafId = 0;
        if (attemptRestore()) return;
        if (performance.now() - startTime >= MAX_WAIT_MS) finish();
      });
    };

    const startObservers = (container: HTMLElement) => {
      mutationObserver = new MutationObserver(scheduleRetry);
      mutationObserver.observe(container, { childList: true, subtree: true });
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(scheduleRetry);
        resizeObserver.observe(container);
      }
      timeoutId = window.setTimeout(finish, MAX_WAIT_MS);
    };

    // Initial attempt — wait one frame so the new route has mounted.
    rafId = requestAnimationFrame(() => {
      if (cancelled || userInterrupted) return;
      if (attemptRestore()) return;
      const container = getManagedScrollContainer();
      if (container) startObservers(container);
      else finish();
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [location.pathname, navigationType]);

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
