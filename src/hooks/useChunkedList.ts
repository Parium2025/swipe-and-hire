import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Renders a list in two phases for buttery-smooth tab switches:
 *
 *  1. The first `initialCount` items appear synchronously (instant paint).
 *  2. The remaining items are appended in the next idle frame, so the browser
 *     can finish the tab-indicator animation, scroll work, and any layout
 *     before we ask it to mount the rest.
 *
 * Visual result is identical to rendering everything at once because the
 * second phase happens within ~1 frame on any modern device. Fade-in
 * animations on individual cards are unaffected.
 *
 * Usage:
 *   const visibleJobs = useChunkedList(pageJobs);
 *   visibleJobs.map(job => <Card ... />)
 */
export function useChunkedList<T>(items: T[], initialCount = 6): T[] {
  const [showAll, setShowAll] = useState(false);
  // Identity hash so we re-chunk only when the list actually changes
  const itemsKey = useMemo(() => items.length, [items]);
  const prevKeyRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevKeyRef.current === itemsKey && showAll) return;
    prevKeyRef.current = itemsKey;

    // Reset and reveal in next idle frame
    setShowAll(false);

    if (items.length <= initialCount) {
      setShowAll(true);
      return;
    }

    let cancelled = false;
    const reveal = () => {
      if (!cancelled) setShowAll(true);
    };

    const w: any = typeof window !== 'undefined' ? window : null;
    if (!w) {
      setShowAll(true);
      return;
    }

    if ('requestIdleCallback' in w) {
      const id = w.requestIdleCallback(reveal, { timeout: 200 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }

    const id = w.setTimeout(reveal, 16);
    return () => {
      cancelled = true;
      w.clearTimeout(id);
    };
  }, [itemsKey, items.length, initialCount, showAll]);

  return showAll ? items : items.slice(0, initialCount);
}
