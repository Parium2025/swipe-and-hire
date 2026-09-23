import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
const isAuthPath = (pathname: string) => pathname === '/auth';

const detectTouch = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(any-pointer: coarse), (hover: none), (any-hover: none)').matches ||
    navigator.maxTouchPoints > 0
  );
};

const detectTabletLandscape = () => {
  if (typeof window === 'undefined') return false;
  return detectTouch() && window.matchMedia(
    '(orientation: landscape) and (min-width: 768px) and (max-width: 1366px)'
  ).matches;
};

const detectStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
};

/** Färgankare som låter Safari måla rätt ruttfärg bakom bottenfältet. */
const BottomChromeStrip = () => {
  const location = useLocation();
  // Match the CSS reservation before first paint. Waiting for useEffect here
  // made the bottom reservation appear one frame after login and could make
  // the entire mobile shell look as though the top edge had jumped.
  const [isTouch, setIsTouch] = useState(detectTouch);
  const [isTabletLandscape, setIsTabletLandscape] = useState(detectTabletLandscape);
  const [isStandalone, setIsStandalone] = useState(detectStandalone);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mqTouch = window.matchMedia('(any-pointer: coarse), (hover: none), (any-hover: none)');
    const mqTablet = window.matchMedia(
      '(orientation: landscape) and (min-width: 768px) and (max-width: 1366px)'
    );
    const apply = () => {
      const hasTouch = mqTouch.matches || navigator.maxTouchPoints > 0;
      setIsTouch(hasTouch);
      setIsTabletLandscape(hasTouch && mqTablet.matches);
    };
    apply();
    mqTouch.addEventListener?.('change', apply);
    mqTablet.addEventListener?.('change', apply);
    return () => {
      mqTouch.removeEventListener?.('change', apply);
      mqTablet.removeEventListener?.('change', apply);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(display-mode: standalone)');
    const apply = () => setIsStandalone(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  // Sync CSS variable so scroll containers always reserve space
  // matching the strip — independent of @media (pointer: coarse).
  // Tablet i landskap: ramen/fodralet täcker mer → extra andrum.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const shouldReserveChrome = isTouch && !isAuthPath(location.pathname);
    if (shouldReserveChrome) {
      const basePx = isTabletLandscape ? 120 : 68;
      root.dataset.touchChrome = 'true';
      root.style.setProperty(
        '--chrome-strip-pad',
        `calc(env(safe-area-inset-bottom, 0px) + ${basePx}px)`
      );
    } else {
      delete root.dataset.touchChrome;
      root.style.removeProperty('--chrome-strip-pad');
    }
    return () => {
      delete root.dataset.touchChrome;
      root.style.removeProperty('--chrome-strip-pad');
    };
  }, [isTouch, isStandalone, isTabletLandscape, location.pathname]);

  // Safari samplar bottenfärgen från dokumentkanten och uppdaterar den inte
  // säkert efter SPA-navigation. Ankaret håller färgen kopplad till rutten.
  if (!isTouch) return null;

  return (
    <div
      data-browser-chrome-strip="bottom"
      key={location.pathname}
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        backgroundColor: 'var(--active-browser-chrome-color, #00193D)',
        zIndex: 2147483647,
        pointerEvents: 'none',
        // Ingen färgövergång — samma frame som innehållet (se TopChromeStrip).
      }}
    />
  );
};

export default BottomChromeStrip;
