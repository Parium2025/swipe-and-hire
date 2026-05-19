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
 * Tunn färgremsa längst ner — endast på mobil/touch.
 * Säkerställer att området bakom iOS Safaris bottenverktygsfält alltid har
 * rätt färg vid SPA-navigering (Safari samplar annars body en gång per
 * sidladdning och uppdaterar inte vid route-byte).
 *
 * Synlig endast på touch-enheter (telefon/surfplatta). Desktop slipper.
 */
const BottomChromeStrip = () => {
  const location = useLocation();
  const [isTouch, setIsTouch] = useState(false);
  const [forcedColor, setForcedColor] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const apply = () => setIsTouch(mq.matches);
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

  useEffect(() => {
    console.log('[BottomChromeStrip]', { path: location.pathname, color: displayColor });
  }, [location.pathname, displayColor]);

  // Sync CSS variable so scroll containers always reserve space
  // matching the strip — independent of @media (pointer: coarse).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isTouch) {
      root.style.setProperty(
        '--chrome-strip-pad',
        'calc(env(safe-area-inset-bottom, 0px) + 68px)'
      );
    } else {
      root.style.removeProperty('--chrome-strip-pad');
    }
    return () => {
      root.style.removeProperty('--chrome-strip-pad');
    };
  }, [isTouch]);

  if (!isTouch) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        backgroundColor: displayColor,
        zIndex: 2147483647,
        pointerEvents: 'none',
        transition: 'background-color 200ms ease-out',
      }}
    />
  );
};

export default BottomChromeStrip;
