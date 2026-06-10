import { useEffect } from 'react';

/**
 * Mjukar upp musens hjulscroll på desktop utan att ta över native scroll.
 *
 * - Aktiveras ENDAST för "klassiska" mushjul (stora diskreta delta).
 * - Trackpad (små kontinuerliga delta) släpps igenom orörd → native känsla bevaras på Mac.
 * - Touch-enheter, reduced-motion, ctrl-zoom och horisontell scroll lämnas i fred.
 * - Inga scroll-bundna element (pinned gallery, hero) tappar synk eftersom vi fortfarande
 *   skriver till window.scrollY — vi interpolerar bara mellan tick:arna.
 */
export function useWheelSmoother(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let targetY = window.scrollY;
    let currentY = window.scrollY;
    let rafId = 0;
    let animating = false;

    const EASE = 0.18; // 0 = trögt, 1 = direkt. ~0.18 ger Apple-känsla.
    const STOP_THRESHOLD = 0.4;

    const tick = () => {
      const diff = targetY - currentY;
      if (Math.abs(diff) < STOP_THRESHOLD) {
        currentY = targetY;
        window.scrollTo(0, currentY);
        animating = false;
        return;
      }
      currentY += diff * EASE;
      window.scrollTo(0, currentY);
      rafId = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      // Tillåt ctrl-zoom, horisontell scroll och scrollbara children
      if (e.ctrlKey || e.metaKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      // Heuristik: mushjul har stora delta (>=50) eller deltaMode 1 (lines).
      // Trackpad har små kontinuerliga delta — släpp igenom dem.
      const isMouseWheel = e.deltaMode === 1 || Math.abs(e.deltaY) >= 50;
      if (!isMouseWheel) return;

      // Kolla om scroll-target är ett scrollbart child (modal, textarea, kodblock)
      let node = e.target as HTMLElement | null;
      while (node && node !== document.body) {
        const style = node.scrollHeight > node.clientHeight ? getComputedStyle(node) : null;
        if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll')) return;
        node = node.parentElement;
      }

      e.preventDefault();

      // Synka om användaren har scrollat med scrollbaren under pågående animation
      if (!animating) currentY = window.scrollY;

      const max = document.documentElement.scrollHeight - window.innerHeight;
      targetY = Math.max(0, Math.min(max, targetY + e.deltaY));

      if (!animating) {
        animating = true;
        rafId = requestAnimationFrame(tick);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(rafId);
    };
  }, [enabled]);
}
