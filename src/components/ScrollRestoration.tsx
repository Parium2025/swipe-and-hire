import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll restoration for inner <main> scroll containers.
 * Saves by pathname so back-navigation always restores correctly.
 */

// Store scroll positions by pathname
const scrollPositions = new Map<string, number>();
let isFrozen = false;

const getMainContainer = (): HTMLElement | null => {
  // Find the scrollable <main> used by JobSeekerLayout / EmployerLayout
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
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const prevPathRef = useRef(pathname);

  // Continuously track scroll position for current pathname
  useEffect(() => {
    const container = getMainContainer();
    if (!container) return;

    const onScroll = () => {
      if (isFrozen) return;
      scrollPositions.set(pathname, container.scrollTop);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
    };
  }, [pathname]);

  // On route change: save outgoing, restore incoming
  useLayoutEffect(() => {
    const prevPath = prevPathRef.current;
    
    // Freeze to prevent scroll-reset events from overwriting saved positions
    isFrozen = true;

    // Save outgoing path's scroll position (captured by scroll listener earlier)
    // No need to re-save here — the scroll listener already saved the latest value

    prevPathRef.current = pathname;

    // Restore scroll position for the new route
    const tryRestore = (attempts = 0) => {
      const container = getMainContainer();
      if (!container) {
        if (attempts < 5) {
          requestAnimationFrame(() => tryRestore(attempts + 1));
        } else {
          isFrozen = false;
        }
        return;
      }

      if (navigationType === 'POP') {
        // Back/forward navigation — restore saved position
        const saved = scrollPositions.get(pathname);
        if (saved !== undefined && saved > 0) {
          container.scrollTop = saved;
          // Verify it took effect (content might not be tall enough yet)
          requestAnimationFrame(() => {
            if (container.scrollTop !== saved && saved > 0 && attempts < 10) {
              container.scrollTop = saved;
            }
            isFrozen = false;
          });
        } else {
          isFrozen = false;
        }
      } else {
        // PUSH navigation — scroll to top
        container.scrollTop = 0;
        requestAnimationFrame(() => {
          isFrozen = false;
        });
      }
    };

    // Wait for React to commit DOM, then restore
    requestAnimationFrame(() => tryRestore());
  }, [pathname, navigationType]);

  // Use manual scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return null;
}
