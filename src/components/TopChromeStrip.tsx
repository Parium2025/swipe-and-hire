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
 * I vanlig webbläsare täcker remsan exakt safe-area (statusraden) — sidorna
 * lägger själva sin safe-area-padding, så ingen content-offset behövs.
 * I installerat app-läge (standalone) får remsan +8px extra och skjuter
 * innehållet ner via --top-chrome-content-offset (oförändrat beteende).
 *
 * Synlig endast på touch-enheter (telefon/surfplatta). Desktop slipper.
 */
const TopChromeStrip = () => {
  const location = useLocation();
  const [isTouch, setIsTouch] = useState(false);
  const [forcedColor, setForcedColor] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

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

  // Remsan visas på alla touch-enheter. Content-offset (som skjuter ner
  // sidinnehållet) gäller bara i standalone — i webbläsaren ligger remsan
  // exakt över statusradens safe-area som sidorna redan paddingar för.
  const shouldShowStrip = isTouch;
  // I vanlig Safari läggs reservmålningen OVANFÖR layoutens nollpunkt. Då kan
  // kompositorn använda färgen bakom browser-chrome utan att 14 px spiller ned
  // över sidan och bildar en andra synlig remsa. En riktig safe-area täcks ändå
  // exakt till sin nederkant: top -14 + height (safe-area + 14) = safe-area.
  const chromeOffset = isStandalone
    ? 'calc(env(safe-area-inset-top, 0px) + 8px)'
    : 'calc(env(safe-area-inset-top, 0px) + 14px)';
  const chromeTop = isStandalone ? '0px' : '-14px';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isTouch && isStandalone) {
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
        top: chromeTop,
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
