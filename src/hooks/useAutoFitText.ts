import { useEffect, useRef } from "react";

/**
 * useAutoFitText
 * Dynamiskt skalar texten ned (en rad) så att den ryms inom sin förälder.
 * - Behåller hela ordet (ingen avstavning eller radbrytning)
 * - Reagerar på text- och storleksförändringar via ResizeObserver
 */
export type AutoFitOptions = {
  min?: number; // px
  max?: number; // px
  step?: number; // px
};

export default function useAutoFitText<T extends HTMLElement>(
  text: string,
  options: AutoFitOptions = {}
) {
  const { min = 8, max = 14, step = 0.25 } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    // Säkerställ enradig text för korrekt mätning
    el.style.whiteSpace = "nowrap";

    const fit = () => {
      if (!el || !parent) return;

      // Starta på max och minska tills det får plats eller når min
      let size = max;
      el.style.fontSize = `${size}px`;

      // Skydda mot osedvanliga mätningar vid display:none
      const parentWidth = parent.clientWidth || parent.getBoundingClientRect().width;
      if (!parentWidth) return;

      // Minska gradvis vid overflow
      let guard = 200; // förhindra oändliga loopar
      while (size > min && el.scrollWidth > parentWidth && guard-- > 0) {
        size = Math.max(min, size - step);
        el.style.fontSize = `${size}px`;
      }
    };

    // Kör initialt
    fit();

    // Observers för storleks- och innehållsförändringar
    const ro = new ResizeObserver(() => fit());
    ro.observe(parent);

    // Lyssna på window-resize (t.ex. panelskalning)
    const onWin = () => fit();
    window.addEventListener("resize", onWin);

    // Kör igen när text ändras (t.ex. nytt yrke)
    // Timeout för att vänta in rendering
    const t = setTimeout(fit, 0);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
      clearTimeout(t);
    };
  }, [text, min, max, step]);

  return ref;
}
