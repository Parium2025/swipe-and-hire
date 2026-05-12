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

    // Lenis needs a content element inside the wrapper
    const content = wrapper.firstElementChild as HTMLElement | null;
    if (!content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.1,
      lerp: 0.1,
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
  }, [selector, enabled]);
}
