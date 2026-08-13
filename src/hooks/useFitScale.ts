import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Mäter tillgänglig bredd och returnerar en skalfaktor så att ett innehåll med
 * fast "designbredd" alltid får plats — utan att något klipps av i kanten.
 *
 * Används av wizardens förhandsvisning där tooltips ("Obs, tryck här!") sitter
 * absolut positionerade utanför telefonmockupen. På smala dialoger räckte inte
 * bredden, vilket klippte första/sista tecknet. Nu krymper hela gruppen
 * proportionerligt i stället.
 */
export function useFitScale(designWidth: number, minScale = 0.6) {
  const [scale, setScale] = useState(1);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;

    const update = (width: number) => {
      if (!width) return;
      const next = Math.max(minScale, Math.min(1, width / designWidth));
      setScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
    };

    update(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) update(entry.contentRect.width);
    });
    ro.observe(node);
    observerRef.current = ro;
  }, [designWidth, minScale]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref, scale };
}
