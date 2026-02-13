import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Custom ScrollRestoration for inner <main> scroll containers.
 * Saves scroll position per location.key and restores on POP (back/forward).
 *
 * Key challenge: when React renders a new route into <main>, scrollTop resets
 * to 0 which fires a scroll event. We guard against this by freezing saves
 * during navigation transitions.
 */

const scrollPositions = new Map<string, number>();
let navigationInProgress = false;

const getScrollContainer = (): HTMLElement | null => {
  const mains = document.querySelectorAll('main');
  for (const m of mains) {
    const style = window.getComputedStyle(m);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      return m;
    }
  }
  return null;
};

export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const currentKeyRef = useRef(location.key);

  // Continuously save scroll position on scroll events
  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    const onScroll = () => {
      // Don't save during navigation — React may have reset scrollTop to 0
      if (navigationInProgress) return;
      const key = currentKeyRef.current;
      if (key) {
        scrollPositions.set(key, container.scrollTop);
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
    };
  }, [location.key]);

  // Handle navigation: save outgoing position, restore or reset incoming
  useLayoutEffect(() => {
    const prevKey = currentKeyRef.current;
    const container = getScrollContainer();

    // Freeze scroll saving during transition
    navigationInProgress = true;

    // Save outgoing scroll position BEFORE React commits new content
    // (useLayoutEffect runs synchronously after render but before paint)
    // Note: by this point React has already committed the new children,
    // so we rely on the scroll listener having saved the position earlier.
    // The freeze above prevents the reset-to-0 from overwriting it.

    // Update current key
    currentKeyRef.current = location.key;

    // Restore or reset after DOM settles
    requestAnimationFrame(() => {
      const c = getScrollContainer();
      if (!c) {
        navigationInProgress = false;
        return;
      }

      if (navigationType === 'POP') {
        const saved = scrollPositions.get(location.key);
        if (saved !== undefined && saved > 0) {
          c.scrollTop = saved;
        }
      } else {
        // New navigation — scroll to top
        c.scrollTop = 0;
      }

      // Unfreeze after another frame to let the scroll settle
      requestAnimationFrame(() => {
        navigationInProgress = false;
      });
    });
  }, [location.key, navigationType]);

  // Disable browser's native scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return null;
}
