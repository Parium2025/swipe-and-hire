import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const SCROLL_STORAGE_KEY = 'parium-scroll-positions';

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

  useEffect(() => {
    const scrollContainer = getManagedScrollContainer();
    if (!scrollContainer) return;

    const handleScroll = () => {
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

    // For scroll-to-top (targetTop === 0) we can apply immediately
    if (targetTop === 0) {
      const scrollContainer = getManagedScrollContainer();
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
      }
      return;
    }

    // For restoring a saved position, we need to wait until:
    // 1. The scroll container exists
    // 2. The container has enough content to scroll to the target position
    // This can take several hundred ms when data is loading after a remount.
    let cancelled = false;
    let rafId: number;
    const startTime = performance.now();
    const MAX_WAIT_MS = 3000;

    const tryRestore = () => {
      if (cancelled) return;
      const scrollContainer = getManagedScrollContainer();
      if (!scrollContainer) {
        if (performance.now() - startTime < MAX_WAIT_MS) {
          rafId = requestAnimationFrame(tryRestore);
        }
        return;
      }

      // Apply scroll position
      scrollContainer.scrollTo({ top: targetTop, behavior: 'auto' });

      // If content hasn't loaded enough, the actual scrollTop will be less than targetTop.
      // Keep retrying until content grows enough or timeout.
      const actualTop = scrollContainer.scrollTop;
      const closeEnough = Math.abs(actualTop - targetTop) < 5;
      if (!closeEnough && performance.now() - startTime < MAX_WAIT_MS) {
        rafId = requestAnimationFrame(tryRestore);
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
