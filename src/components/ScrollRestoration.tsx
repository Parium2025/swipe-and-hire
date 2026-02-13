import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Custom ScrollRestoration that works with inner <main> scroll containers.
 * Saves scroll position per route key and restores on POP (back/forward).
 */

const scrollPositions = new Map<string, number>();

export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prevKeyRef = useRef<string | null>(null);

  // Find the scrollable <main> element inside the layout
  const getScrollContainer = useCallback((): HTMLElement | null => {
    // The layout uses <main> with overflow-y-auto as the scroll container
    const mains = document.querySelectorAll('main');
    for (const m of mains) {
      const style = window.getComputedStyle(m);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return m;
      }
    }
    return null;
  }, []);

  // Save current scroll position before navigating away
  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    const saveScroll = () => {
      const key = prevKeyRef.current || location.key;
      if (key) {
        scrollPositions.set(key, container.scrollTop);
      }
    };

    container.addEventListener('scroll', saveScroll, { passive: true });
    return () => {
      // Save final position on cleanup (navigation happening)
      saveScroll();
      container.removeEventListener('scroll', saveScroll);
    };
  }, [location.key, getScrollContainer]);

  // Restore or reset scroll on navigation
  useLayoutEffect(() => {
    // Save previous route's position
    if (prevKeyRef.current) {
      const container = getScrollContainer();
      if (container) {
        scrollPositions.set(prevKeyRef.current, container.scrollTop);
      }
    }

    const restoreScroll = () => {
      const container = getScrollContainer();
      if (!container) return;

      if (navigationType === 'POP') {
        // Back/forward — restore saved position
        const saved = scrollPositions.get(location.key);
        if (saved !== undefined) {
          container.scrollTop = saved;
        }
      } else {
        // New navigation — scroll to top
        container.scrollTop = 0;
      }
    };

    // Use rAF to ensure DOM has updated
    requestAnimationFrame(() => {
      restoreScroll();
      // Double-rAF for lazy-loaded content
      requestAnimationFrame(restoreScroll);
    });

    prevKeyRef.current = location.key;
  }, [location.key, navigationType, getScrollContainer]);

  // Disable browser's native scroll restoration (we handle it manually)
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return null;
}
