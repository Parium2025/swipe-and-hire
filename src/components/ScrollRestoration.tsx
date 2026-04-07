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

    // For restoring a saved position, we need to wait until:
    // 1. The scroll container exists
    // 2. The container has enough content to scroll to the target position
    const startTime = performance.now();
    let stableFrames = 0;

    const tryRestore = () => {
      if (cancelled) return;

      const scrollContainer = getManagedScrollContainer();
      if (!scrollContainer) {
        if (performance.now() - startTime < MAX_WAIT_MS) {
          rafId = requestAnimationFrame(tryRestore);
        } else {
          releaseRestoreLock();
        }
        return;
      }

      const anchorDelta = getAnchorDelta(
        scrollContainer,
        storedPosition?.anchorId,
        storedPosition?.anchorOffset,
      );

      if (anchorDelta !== null) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollTop + anchorDelta, behavior: 'auto' });
      } else {
        scrollContainer.scrollTo({ top: targetTop, behavior: 'auto' });
      }

      // Check if we're close enough & content has loaded
      const actualTop = scrollContainer.scrollTop;
      const nextAnchorDelta = getAnchorDelta(
        scrollContainer,
        storedPosition?.anchorId,
        storedPosition?.anchorOffset,
      );
      const closeEnough = nextAnchorDelta !== null
        ? Math.abs(nextAnchorDelta) <= RESTORE_TOLERANCE_PX
        : Math.abs(actualTop - targetTop) <= RESTORE_TOLERANCE_PX;
      const heightReady = !storedPosition?.scrollHeight
        || scrollContainer.scrollHeight >= storedPosition.scrollHeight - SCROLL_HEIGHT_TOLERANCE_PX;

      if (closeEnough && heightReady) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }

      if (stableFrames >= REQUIRED_STABLE_FRAMES) {
        releaseRestoreLock();
        return;
      }

      if (performance.now() - startTime < MAX_WAIT_MS) {
        rafId = requestAnimationFrame(tryRestore);
      } else {
        releaseRestoreLock();
      }
    };

    rafId = requestAnimationFrame(tryRestore);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
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
