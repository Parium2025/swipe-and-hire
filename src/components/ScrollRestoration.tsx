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
    let attempts = 0;

    const applyScroll = () => {
      const scrollContainer = getManagedScrollContainer();
      if (!scrollContainer) {
        if (attempts < 12) {
          attempts += 1;
          requestAnimationFrame(applyScroll);
        }
        return;
      }

      const positions = readPositions();
      const targetTop = navigationType === 'POP' ? (positions[location.pathname] ?? 0) : 0;
      scrollContainer.scrollTo({ top: targetTop, behavior: 'auto' });
    };

    applyScroll();
  }, [location.pathname, navigationType]);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return null;
}
