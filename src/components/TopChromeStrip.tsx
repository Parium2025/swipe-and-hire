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
 * Tunn färgremsa längst upp — speglar BottomChromeStrip exakt.
 *
 * Med `viewport-fit=cover` sträcker sig sidan in bakom iOS statusrad.
 * iOS Safari samplar body's bakgrundsfärg EN gång vid sidladdning och
 * uppdaterar inte vid SPA-navigering — om man landade på startsidan
 * (grå #2a2a2a) och navigerar till /auth syns en mörk rand kvar högst upp.
 * Samma problem som bottenremsan löser, samma lösning: en fixed remsa som
 * lyssnar på react-router location och alltid målar rätt ruttfärg.
 *
 * Remsan ligger ovanför appens innehåll. Samma höjd sätts därför alltid som
 * content-offset på touch-enheter, så att den aldrig kan täcka eller klippa
 * toppmenyn när en webbläsare rapporterar 0 px safe-area.
 *
 * Synlig endast på touch-enheter (telefon/surfplatta). Desktop slipper.
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

  // Remsan visas på alla touch-enheter och dess fulla höjd reserveras ovanför
  // appens toppmeny. Annars täcker 14 px-överlappet ikonernas överkant när
  // Safari rapporterar safe-area som 0.
  const shouldShowStrip = isTouch;
  // Samma 14 px överlapp som BottomChromeStrip. Safe-area kan rapporteras
  // som 0 i vanlig iPhone-Safari; överlappet ser då till att remsan ändå
  // målar ända in bakom den övre webbläsarkanten i stället för att bli 0 px.
  // Vanlig Safari: remsan får ALDRIG sticka ut under statusraden. Nyare iOS
  // (flytande verktygsfält) visar annars de extra pixlarna som en mörk rad
  // mellan statusraden och toppmenyn. Endast installerat app-läge behåller
  // sitt extra andrum.
  const stripInset = isStandalone ? '22px' : '0px';
  const chromeOffset = `calc(env(safe-area-inset-top, 0px) + ${stripInset})`;

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isTouch) {
      root.style.setProperty('--top-chrome-content-offset', chromeOffset);
    } else {
      root.style.removeProperty('--top-chrome-content-offset');
    }
    return () => {
      root.style.removeProperty('--top-chrome-content-offset');
    };
  }, [isTouch, isStandalone, chromeOffset]);

  if (!shouldShowStrip) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 0,
        height: chromeOffset,
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
