import { useEffect } from 'react';

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

    let rafId = 0;
    let lenis: { raf: (time: number) => void; destroy: () => void } | null = null;
    let cancelled = false;

    const setup = async () => {
      const moduleName = 'lenis';
      const mod = await import(/* @vite-ignore */ moduleName).catch(() => null) as { default?: new (options: Record<string, unknown>) => { raf: (time: number) => void; destroy: () => void } } | null;
      if (cancelled || !mod?.default) return;
      const Lenis = mod.default;
      lenis = new Lenis({
        wrapper,
        content,
        // Längre duration + lägre lerp = tyngre, mer "premium" scrollkänsla
        // som matchar pinned-galleriets tempo och tar bort plötsliga växlingar.
        duration: 1.6,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        // Dämpar snabba scroll-utbrott så även "blixtscroll" känns kontrollerad
        wheelMultiplier: 0.85,
        touchMultiplier: 1.0,
        lerp: 0.07,
      });
      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    };
    setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      lenis?.destroy();
    };
  }, [selector, enabled]);
}
