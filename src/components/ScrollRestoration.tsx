import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll restoration for inner <main> scroll containers.
 * 
 * Challenge: some routes (e.g. /job-view) render outside the layout,
 * so the layout's <main> unmounts and remounts. We use aggressive
 * retries to wait for the container to exist AND have enough content.
 */

const scrollPositions = new Map<string, number>();
let isFrozen = false;

const getMainContainer = (): HTMLElement | null => {
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
  const retryTimerRef = useRef<number | null>(null);

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

  // On route change: restore or reset scroll
  useLayoutEffect(() => {
    // Clear any pending retry
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    isFrozen = true;
    prevPathRef.current = pathname;

    if (navigationType === 'POP') {
      const saved = scrollPositions.get(pathname);

      if (saved !== undefined && saved > 0) {
        // Retry until container exists and is tall enough
        let attempts = 0;
        const tryRestore = () => {
          attempts++;
          const container = getMainContainer();

          if (container && container.scrollHeight >= saved) {
            container.scrollTop = saved;
            // Verify
            requestAnimationFrame(() => {
              if (container.scrollTop !== saved) {
                container.scrollTop = saved;
              }
              isFrozen = false;
            });
          } else if (attempts < 30) {
            // Retry every 50ms for up to 1.5 seconds
            retryTimerRef.current = window.setTimeout(tryRestore, 50);
          } else {
            // Give up — set whatever we can
            if (container) {
              container.scrollTop = saved;
            }
            isFrozen = false;
          }
        };

        // Start trying after first frame
        requestAnimationFrame(tryRestore);
      } else {
        isFrozen = false;
      }
    } else {
      // PUSH — scroll to top
      requestAnimationFrame(() => {
        const container = getMainContainer();
        if (container) {
          container.scrollTop = 0;
        }
        // Also reset window scroll (for pages outside layouts like JobView)
        window.scrollTo(0, 0);
        isFrozen = false;
      });
    }

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [pathname, navigationType]);

  // Use manual scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return null;
}
