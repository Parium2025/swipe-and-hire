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

  if (!isTouch) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: isStandalone ? 0 : 'calc(-1 * env(safe-area-inset-top, 0px))',
        // Extra top-remsa som täcker hela statusområdet + en tunn kant under.
        // I browser-läge behöver den sticka upp över safe-area eftersom sidan
        // själv har negativ safe-area offset; i PWA-läge räcker vanlig top: 0.
        height: isStandalone
          ? 'calc(env(safe-area-inset-top, 0px) + 4px)'
          : 'calc(env(safe-area-inset-top, 0px) + 10px)',
        backgroundColor: displayColor,
        background: 'var(--active-browser-chrome-color)',
        zIndex: 2147483647,
        pointerEvents: 'none',
        transition: 'background-color 200ms ease-out',
      }}
    />
  );
};

export default TopChromeStrip;
