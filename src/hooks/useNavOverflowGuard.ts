import { useEffect, useRef } from 'react';
import { reportNavRequiredWidth } from '@/hooks/use-device';

/**
 * Watches the desktop top nav and reports how much width its content really
 * needs. If the content ever overflows its container we raise the global
 * desktop breakpoint, so the app switches to the mobile layout instead of
 * showing a cramped/clipped header. Purely presentational.
 */
export function useNavOverflowGuard<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      // scrollWidth > clientWidth means the nav items no longer fit.
      const overflow = el.scrollWidth - el.clientWidth;
      if (overflow > 1) {
        reportNavRequiredWidth(window.innerWidth + overflow);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return ref;
}
