import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import {
  getManagedScrollContainer,
  readPositions,
  writePositions,
  getAnchorSnapshot,
  getAnchorDelta,
  RESTORE_TOLERANCE_PX,
  SCROLL_HEIGHT_TOLERANCE_PX,
  MAX_WAIT_MS,
} from '@/lib/scrollRestoration';

export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isRestoringRef = useRef(false);
  const pendingSaveFrameRef = useRef<number | null>(null);
  const isJobViewOverlayPath = location.pathname.startsWith('/job-view/') || location.pathname.startsWith('/job/');

  // -----------------------------------------------------------------------
  // Save scroll position on user scroll
  // -----------------------------------------------------------------------
  useEffect(() => {
    // JobView är en overlay ovanpå den befintliga listan. Den får ALDRIG trigga
    // global restore/save mot huvudscrollen — annars hoppar bakgrundslistan till
    // toppen medan detaljsidan ligger ovanpå, vilket skapar blink/hack vid back.
    if (isJobViewOverlayPath) return;

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
  }, [location.pathname, isJobViewOverlayPath]);

  // -----------------------------------------------------------------------
  // Restore scroll position on navigation
  // -----------------------------------------------------------------------
  useLayoutEffect(() => {
    if (isJobViewOverlayPath) return;

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

      const scrollContainer = getManagedScrollContainer();
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
      const previousBehavior = scrollContainer.style.scrollBehavior;
      scrollContainer.style.scrollBehavior = 'auto';
      if (anchorDelta !== null) {
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
  }, [location.pathname, navigationType, isJobViewOverlayPath]);

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
