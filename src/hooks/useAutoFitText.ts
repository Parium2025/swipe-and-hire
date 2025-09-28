import { useEffect, useRef } from "react";

/**
 * useAutoFitText
 * Skalar ned texten (en rad) så att den ryms inom en given container.
 * - Väljer containerRef om den skickas in, annars används elementets förälder
 * - Mäter innehållsbredd (exkl. padding) och justerar font-size/scaleX
 */
export type AutoFitOptions = {
  min?: number; // px
  max?: number; // px
  step?: number; // px
};

export default function useAutoFitText<T extends HTMLElement>(
  text: string,
  options: AutoFitOptions = {},
  containerRef?: React.RefObject<HTMLElement>
) {
  const { min = 4, max = 14, step = 0.1 } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    const container = (containerRef?.current as HTMLElement | null) || el?.parentElement || null;
    if (!el || !container) return;

    // Enradig mätning
    el.style.whiteSpace = "nowrap";
    el.style.display = "inline-block";
    el.style.transformOrigin = "left center";
    el.style.maxWidth = "100%";

    const getContentWidth = (node: HTMLElement) => {
      const styles = window.getComputedStyle(node);
      const padL = parseFloat(styles.paddingLeft || "0");
      const padR = parseFloat(styles.paddingRight || "0");
      const cw = node.clientWidth; // opåverkad av CSS-transform
      return Math.max(0, cw - padL - padR);
    };

    const fit = () => {
      // Nollställ
      el.style.transform = "none";
      let size = max;
      el.style.fontSize = `${size}px`;
      el.style.maxWidth = "100%";

      const targetWidth = getContentWidth(container);
      if (!targetWidth) return;

      // Minska font-size tills dess att scrollWidth ryms i targetWidth
      let guard = 500;
      while (size > min) {
        const w = el.scrollWidth; // opåverkat av transform
        if (w <= targetWidth || guard-- <= 0) break;
        size = Math.max(min, size - step);
        el.style.fontSize = `${size}px`;
      }

      // Om det fortfarande inte får plats -> scaleX
      const wFinal = el.scrollWidth;
      if (wFinal > targetWidth) {
        const scale = Math.max(0.5, targetWidth / wFinal);
        el.style.transform = `scaleX(${scale})`;
      }
    };
    // Init och observers
    fit();

    const ro = new ResizeObserver(() => fit());
    ro.observe(container);

    const onWin = () => fit();
    window.addEventListener("resize", onWin);
    const t = setTimeout(fit, 0);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
      clearTimeout(t);
    };
  }, [text, min, max, step, containerRef]);

  return ref;
}
