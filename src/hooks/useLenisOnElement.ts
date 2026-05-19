import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Attaches a Lenis smooth-scroll instance to a custom scrollable element
 * (the landing-page scroll root). Free, open-source alternative to
 * GSAP ScrollSmoother — gives the same buttery, premium scroll feel.
 */
export function useLenisOnElement(selector: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const wrapper = document.querySelector(selector) as HTMLElement | null;
    if (!wrapper) return;

    // Lenis needs the actual scrollable content, not fixed decorative layers.
    const content = (wrapper.querySelector('[data-lenis-content]') as HTMLElement | null)
      ?? (wrapper.firstElementChild as HTMLElement | null);
    if (!content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      eventsTarget: wrapper,
      // Längre duration + lägre lerp = tyngre, mer "premium" scrollkänsla
      // som matchar pinned-galleriets tempo och tar bort plötsliga växlingar.
      duration: 1.6,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: true,
      syncTouchLerp: 0.08,
      touchInertiaExponent: 1.45,
      // Dämpar snabba scroll-utbrott så även "blixtscroll" känns kontrollerad
      wheelMultiplier: 0.85,
      touchMultiplier: 1.0,
      lerp: 0.07,
      overscroll: false,
    });

    const onStop = () => lenis.stop();
    const onStart = () => lenis.start();
    const onResize = () => lenis.resize();
    window.addEventListener('parium:lenis-stop', onStop);
    window.addEventListener('parium:lenis-start', onStart);
    window.addEventListener('parium:lenis-resize', onResize);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      window.removeEventListener('parium:lenis-stop', onStop);
      window.removeEventListener('parium:lenis-start', onStart);
      window.removeEventListener('parium:lenis-resize', onResize);
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [selector, enabled]);
}
