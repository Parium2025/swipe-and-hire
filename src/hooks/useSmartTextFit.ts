import { useEffect, useRef } from "react";

export default function useSmartTextFit<T extends HTMLElement>(
  text: string,
  options: { minFontPx?: number } = {}
) {
  const { minFontPx = 10 } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !text) return;

    const fit = () => {
      // Återställ all styling
      el.style.transform = 'none';
      el.style.transformOrigin = '';
      el.style.whiteSpace = '';
      el.style.fontSize = '';

      requestAnimationFrame(() => {
        // Hitta närmaste kort-container (har paddings som påverkar bredden)
        const container = (el.closest('.bg-white\\/10') || el.parentElement) as HTMLElement | null;
        if (!container) return;

        // Tillgänglig bredd i containern
        const cStyles = getComputedStyle(container);
        const availableWidth = container.clientWidth
          - parseFloat(cStyles.paddingLeft)
          - parseFloat(cStyles.paddingRight)
          - 4; // liten säkerhetsmarginal

        // Mät faktisk enkelrad-bredd
        const originalWhiteSpace = el.style.whiteSpace;
        const originalFont = getComputedStyle(el).fontSize;
        let currentFont = parseFloat(originalFont) || 12;

        el.style.whiteSpace = 'nowrap';
        let singleLineWidth = el.scrollWidth;

        if (singleLineWidth <= availableWidth) {
          // Får redan plats, återställ white-space
          el.style.whiteSpace = originalWhiteSpace;
          return;
        }

        // Krymp font-size stegvis tills det får plats
        while (singleLineWidth > availableWidth && currentFont > minFontPx) {
          currentFont -= 0.25;
          el.style.fontSize = `${currentFont}px`;
          singleLineWidth = el.scrollWidth;
        }

        // Säkerställ enkelrad och att inget klipps
        el.style.whiteSpace = 'nowrap';
        el.style.overflow = 'visible';
      });
    };

    // Kör efter kort delay för att säkerställa rendering
    const timeout = setTimeout(fit, 50);
    const resizeObserver = new ResizeObserver(() => setTimeout(fit, 10));
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeout);
    };
  }, [text, minFontPx]);

  return ref;
}