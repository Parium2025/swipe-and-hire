import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BROWSER_CHROME_COLOR_EVENT } from '@/lib/browserChrome';

const LANDING_COLOR = '#2a2a2a';
const PARIUM_COLOR = '#00193D';
const AUDIENCE_LANDING_COLOR = '#001F3D';
const AUTH_COLOR = '#062B5E';

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';
const isAudienceLandingPath = (pathname: string) =>
  pathname === '/arbetsgivare' || pathname === '/jobbsokare';
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

/**
 * Tunn färgremsa längst ner — endast på mobil/touch.
 * Säkerställer att området bakom iOS Safaris bottenverktygsfält alltid har
 * rätt färg vid SPA-navigering (Safari samplar annars body en gång per
 * sidladdning och uppdaterar inte vid route-byte).
 *
 * Synlig endast på touch-enheter (telefon/surfplatta). Desktop slipper.
 */
const BottomChromeStrip = () => {
  const location = useLocation();
  // Match the CSS reservation before first paint. Waiting for useEffect here
  // made the bottom reservation appear one frame after login and could make
  // the entire mobile shell look as though the top edge had jumped.
  const [isTouch, setIsTouch] = useState(detectTouch);
  const [isTabletLandscape, setIsTabletLandscape] = useState(detectTabletLandscape);
  const [forcedColor, setForcedColor] = useState<string | null>(null);

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

  const color = isLandingVideoPath(location.pathname)
    ? LANDING_COLOR
    : isAudienceLandingPath(location.pathname)
      ? AUDIENCE_LANDING_COLOR
      : isAuthPath(location.pathname)
        ? AUTH_COLOR
        : PARIUM_COLOR;

  useEffect(() => {
    setForcedColor(null);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChromeColor = (event: Event) => {
      const detail = (event as CustomEvent<{ color?: string }>).detail;
      if (detail?.color) setForcedColor(detail.color);
    };
    window.addEventListener(BROWSER_CHROME_COLOR_EVENT, onChromeColor);
    return () => window.removeEventListener(BROWSER_CHROME_COLOR_EVENT, onChromeColor);
  }, []);

  const displayColor = forcedColor ?? color;

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
  }, [isTouch, isTabletLandscape, location.pathname]);

  if (!isTouch) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        // Endast safe-area: remsan ska ligga helt bakom webbläsarens egen
        // bottenlist och aldrig synas som en mörk rad ovanför den.
        height: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        backgroundColor: displayColor,
        zIndex: 2147483647,
        pointerEvents: 'none',
        // Ingen färgövergång — samma frame som innehållet (se TopChromeStrip).
      }}
    />
  );
};

export default BottomChromeStrip;
