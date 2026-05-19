import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

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
    console.log('[TopChromeStrip]', { path: location.pathname, color });
  }, [location.pathname, color]);

  if (!isTouch) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 0,
        height: 'env(safe-area-inset-top, 0px)',
        backgroundColor: color,
        zIndex: 2147483647,
        pointerEvents: 'none',
        transition: 'background-color 200ms ease-out',
      }}
    />
  );
};

export default TopChromeStrip;
