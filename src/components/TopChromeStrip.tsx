import { useEffect } from 'react';
import { useBrowserChromeStrip } from '@/hooks/useBrowserChromeStrip';

/**
 * Tunn färgremsa längst upp — speglar BottomChromeStrip för iOS safe-area.
 * Färgen byts automatiskt vid SPA-nav eftersom komponenten lyssnar på
 * react-router location (samma mönster som botten).
 */
const TopChromeStrip = () => {
  const { color, isTouch } = useBrowserChromeStrip();
  // Spegla bottenremsan även i vanlig mobilwebbläsare. viewport-fit=cover gör
  // att samma yta målar området bakom iOS statusrad i stället för svart.
  const shouldShowStrip = isTouch;
  const chromeOffset = 'calc(env(safe-area-inset-top, 0px) + 14px)';

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
        backgroundColor: color,
        zIndex: 2147483647,
        pointerEvents: 'none',
      }}
    />
  );
};

export default TopChromeStrip;
