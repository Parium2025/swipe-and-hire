import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getBrowserChromeColor } from '@/lib/browserChrome';

/**
 * Tunn färgremsa längst upp — spegelbild av BottomChromeStrip.
 * Garanterar att området bakom iOS Safaris URL-bar alltid har rätt färg
 * vid SPA-navigering, eftersom Safari annars cachar theme-color från first paint.
 *
 * Synlig endast på touch-enheter (telefon/surfplatta). Desktop slipper.
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

  const color = getBrowserChromeColor(location.pathname);

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
