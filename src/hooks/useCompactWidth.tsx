import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Mäter ett elements faktiska bredd och returnerar `compact` när det är
 * smalare än `threshold`. Används för att växla till ikon-läge istället för
 * att låta knapptexter kapas på smala kort/skärmar.
 */
export function useCompactWidth(threshold = 320) {
  const [compact, setCompact] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;
    const update = (width: number) => setCompact(width > 0 && width < threshold);
    update(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) update(entry.contentRect.width);
    });
    ro.observe(node);
    observerRef.current = ro;
  }, [threshold]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref, compact };
}
