import { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

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

/** Färgankare som låter Safari måla rätt ruttfärg bakom statusfältet. */
const TopChromeStrip = () => {
  const location = useLocation();
  // Detect synchronously in the browser. Waiting for useEffect caused the
  // top offset to appear one frame after login, which looked like a dark gap.
  const [isTouch, setIsTouch] = useState(detectTouch);
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

  // iPhone Safari behåller annars föregående rutts färg tills en full reload.
  // Ankaret behövs därför även i vanlig Safari, inte bara installerat läge.
  const shouldShowStrip = isTouch;
  // 14 px är den tidigare fungerande Safari-överlappningen. Fem pixlar nådde
  // inte tillräckligt långt in i webbläsarens samplingsyta på fysisk iPhone.
  const stripHeight = isStandalone
    ? 'calc(env(safe-area-inset-top, 0px) + 22px)'
    : 'calc(env(safe-area-inset-top, 0px) + 14px)';
  const chromeOffset = stripHeight;

  useLayoutEffect(() => {
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

  return (
    <div
      data-browser-chrome-strip="top"
      key={location.pathname}
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 0,
        height: stripHeight,
        backgroundColor: 'var(--active-browser-chrome-color, #00193D)',
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
