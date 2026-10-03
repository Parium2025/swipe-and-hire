import { useEffect, useState } from 'react';

/**
 * Keeps the currently displayed image until a new URL (e.g. a freshly signed
 * URL for the same picture after a tab switch) has fully decoded, so avatars
 * never blank out while the browser fetches the replacement.
 */
export function useStableImageSrc(url: string | null | undefined): string | null {
  const [shown, setShown] = useState<string | null>(url ?? null);

  useEffect(() => {
    if (!url) { setShown(null); return; }
    if (url === shown) return;
    if (!shown) { setShown(url); return; }
    let cancelled = false;
    const img = new Image();
    img.src = url;
    const swap = () => { if (!cancelled) setShown(url); };
    (img.decode ? img.decode() : Promise.reject()).then(swap).catch(() => {
      img.onload = swap;
      img.onerror = swap;
      if (img.complete) swap();
    });
    return () => { cancelled = true; img.onload = null; img.onerror = null; };
  }, [url, shown]);

  return shown;
}
