import { useEffect, useLayoutEffect, useState } from 'react';
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

const detectStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
};

/**
 * Färgankare för Safari längst upp och safe-area-fyllning i installerat läge.
 *
 * Med `viewport-fit=cover` sträcker sig sidan in bakom iOS statusrad.
 * iOS Safari samplar body's bakgrundsfärg EN gång vid sidladdning och
 * uppdaterar inte vid SPA-navigering — om man landade på startsidan
 * (grå #2a2a2a) och navigerar till /auth syns en mörk rand kvar högst upp.
 * Samma problem som bottenremsan löser, samma lösning: en fixed remsa som
 * lyssnar på react-router location och alltid målar rätt ruttfärg.
 *
 * Safari 26 hämtar inte längre webbläsarfärgen från theme-color utan från ett
 * fixed/sticky element som möter viewportens kant. I vanlig Safari räcker en
 * enda pixel: den triggar rätt färg men skapar ingen synlig extrarad.
 *
 * Installerat app-läge fyller fortfarande hela safe-area.
 */
const TopChromeStrip = () => {
  const location = useLocation();
  // Detect synchronously in the browser. Waiting for useEffect caused the
  // top offset to appear one frame after login, which looked like a dark gap.
  const [isTouch, setIsTouch] = useState(detectTouch);
  const [forcedColor, setForcedColor] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(detectStandalone);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(any-pointer: coarse), (hover: none), (any-hover: none)');
    const apply = () => setIsTouch(mq.matches || navigator.maxTouchPoints > 0);
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

  const shouldShowStrip = isTouch;
  const stripHeight = isStandalone
    ? 'calc(env(safe-area-inset-top, 0px) + 22px)'
    : '1px';
  const chromeOffset = isStandalone ? stripHeight : '0px';

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (shouldShowStrip) {
      root.style.setProperty('--top-chrome-content-offset', chromeOffset);
    } else {
      root.style.setProperty('--top-chrome-content-offset', '0px');
    }
    return () => {
      root.style.removeProperty('--top-chrome-content-offset');
    };
  }, [shouldShowStrip, chromeOffset]);

  if (!shouldShowStrip) return null;

  return (
    <div
      // Ny nod vid färgbyte: iOS Safari (flytande verktygsfält) samplar om
      // statusrad/verktygsfält först när ett nytt fixed-element dyker upp.
      key={displayColor}
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
        // Ingen färgövergång: remsan måste byta färg i samma frame som
        // sidinnehållet. En 200 ms-fade lämnade en grå efterbild över det
        // blå när man bytte från landningssidan till hem.
      }}
    />
  );
};

export default TopChromeStrip;
