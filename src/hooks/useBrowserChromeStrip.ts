import { useEffect, useState } from 'react';
import { useLocation } from '@/lib/router-compat';
import { BROWSER_CHROME_COLOR_EVENT } from '@/lib/browserChrome';
import { getBrowserChromeColor } from '@/lib/browserChromeConfig';

export const useBrowserChromeStrip = () => {
  const location = useLocation();
  const [isTouch, setIsTouch] = useState(false);
  const [forcedColor, setForcedColor] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(any-pointer: coarse), (hover: none), (any-hover: none)');
    const apply = () => setIsTouch(media.matches || navigator.maxTouchPoints > 0);
    apply();
    media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => setForcedColor(null), [location.pathname]);

  useEffect(() => {
    const onChromeColor = (event: Event) => {
      const detail = (event as CustomEvent<{ color?: string }>).detail;
      if (detail?.color) setForcedColor(detail.color);
    };
    window.addEventListener(BROWSER_CHROME_COLOR_EVENT, onChromeColor);
    return () => window.removeEventListener(BROWSER_CHROME_COLOR_EVENT, onChromeColor);
  }, []);

  return {
    color: forcedColor ?? getBrowserChromeColor(location.pathname),
    isTouch,
    pathname: location.pathname,
  };
};