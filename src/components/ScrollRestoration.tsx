import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const SCROLL_STORAGE_KEY = 'parium-scroll-positions';
const RESTORE_TOLERANCE_PX = 2;
const REQUIRED_STABLE_FRAMES = 2;

const getManagedScrollContainer = (): HTMLElement | null => {
  return document.querySelector('[data-main-scroll-container="true"]');
};

const readPositions = (): Record<string, number> => {
  try {
    const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writePositions = (positions: Record<string, number>) => {
  try {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
};

export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isRestoringRef = useRef(false);

  useEffect(() => {
    const scrollContainer = getManagedScrollContainer();
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (isRestoringRef.current) return;

      const positions = readPositions();
      positions[location.pathname] = scrollContainer.scrollTop;
      writePositions(positions);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  useLayoutEffect(() => {
    const positions = readPositions();
    const targetTop = navigationType === 'POP' ? (positions[location.pathname] ?? 0) : 0;
    let cancelled = false;
    let rafId = 0;

    const releaseRestoreLock = () => {
      requestAnimationFrame(() => {
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
    // This can take several hundred ms when data is loading after a remount.
    const startTime = performance.now();
    const MAX_WAIT_MS = 3000;
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

      // Apply scroll position
      scrollContainer.scrollTo({ top: targetTop, behavior: 'auto' });

      // If content hasn't loaded enough, the actual scrollTop will be less than targetTop.
      // Keep retrying until content grows enough or timeout.
      const actualTop = scrollContainer.scrollTop;
      const closeEnough = Math.abs(actualTop - targetTop) <= RESTORE_TOLERANCE_PX;

      if (closeEnough) {
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

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return null;
}
