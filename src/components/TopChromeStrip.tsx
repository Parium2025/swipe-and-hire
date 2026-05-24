import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BROWSER_CHROME_COLOR_EVENT } from '@/lib/browserChrome';

const LANDING_COLOR = '#2a2a2a';
const PARIUM_COLOR = '#001935';
const AUDIENCE_LANDING_COLOR = '#001F3D';

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';
const isAudienceLandingPath = (pathname: string) =>
  pathname === '/arbetsgivare' || pathname === '/jobbsokare';

/**
 * Tunn färgremsa längst upp — speglar BottomChromeStrip för iOS safe-area.
 * Färgen byts automatiskt vid SPA-nav eftersom komponenten lyssnar på
 * react-router location (samma mönster som botten).
 */
const TopChromeStrip = () => {
  const location = useLocation();
  const [isTouch, setIsTouch] = useState(false);
  const [forcedColor, setForcedColor] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const apply = () => setIsTouch(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(display-mode: standalone)');
    const apply = () => setIsStandalone(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  // iPad / tablet detection — coarse pointer + 768–1366px width.
  // iPad Safari låter inte webbsidan måla över den native URL-raden pålitligt.
  // Därför ska vi INTE lägga en tjock overlay här — den hamnar bara över UI:t.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: coarse) and (min-width: 768px) and (max-width: 1366px)');
    const apply = () => setIsTablet(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const color = isLandingVideoPath(location.pathname)
    ? LANDING_COLOR
    : isAudienceLandingPath(location.pathname)
      ? AUDIENCE_LANDING_COLOR
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
  const shouldShowStrip = isTouch && !(isTablet && !isStandalone);
  const stripInset = isStandalone ? '8px' : '18px';
  const chromeOffset = `calc(env(safe-area-inset-top, 0px) + ${stripInset})`;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (shouldShowStrip) {
      root.style.setProperty('--top-chrome-content-offset', chromeOffset);
    } else {
      root.style.removeProperty('--top-chrome-content-offset');
    }
    return () => {
      root.style.removeProperty('--top-chrome-content-offset');
    };
  }, [shouldShowStrip, chromeOffset]);

  if (!shouldShowStrip) return null;

  // Höjd på toppremsan:
  // - Standalone PWA: tunn (8px), status-bar färgas av apple-mobile-web-app-status-bar-style.
  // - Mobil i browser: 18px räcker — theme-color funkar pålitligt på iPhone Safari.
  const stripHeight = chromeOffset;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 0,
        height: stripHeight,
        backgroundColor: displayColor,
        zIndex: 2147483647,
        pointerEvents: 'none',
        transition: 'background-color 200ms ease-out',
      }}
    />
  );
};

export default TopChromeStrip;
