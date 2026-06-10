import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Smooth scroll för desktop med mus (Windows + Mac med vanlig mus).
 * - Inaktiveras på touch-enheter (mobil/tablet) — native scroll är bättre där.
 * - Respekterar prefers-reduced-motion.
 * - Mjuk men snabb tuning så det inte känns laggy på Mac-trackpad.
 */
export function useSmoothScroll(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    // Skippa touch-enheter — native scroll är optimerat där
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) return;

    // Respektera reduced motion
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const lenis = new Lenis({
      // Kort duration → snabb respons, känns inte laggy på trackpad
      duration: 0.9,
      // Apple-style ease-out
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Endast vertikal
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      // Lägre wheelMultiplier = mjukare, men inte trögt
      wheelMultiplier: 1,
      touchMultiplier: 2,
      // Native smoothing — Lenis tar över
      smoothWheel: true,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [enabled]);
}
