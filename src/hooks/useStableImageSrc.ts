import { useEffect, useState } from 'react';

/**
 * Keeps the currently displayed image until a new URL (e.g. a freshly signed
 * URL for the same picture after a tab switch) has fully decoded, so avatars
 * never blank out while the browser fetches the replacement.
 */
export function useStableImageSrc(url: string | null | undefined, scope?: string): string | null {
  const [shown, setShown] = useState<{ url: string; scope?: string } | null>(null);

  useEffect(() => {
    if (!url) { setShown(null); return; }
    if (url === shown?.url && scope === shown.scope) return;
    let cancelled = false;
    const img = new Image();
    const swap = () => {
      if (!cancelled && img.naturalWidth > 0) setShown({ url, scope });
    };
    img.onload = () => { if (typeof img.decode !== 'function') swap(); };
    img.src = url;
    if (typeof img.decode === 'function') img.decode().then(swap).catch(() => {});
    else if (img.complete) swap();
    return () => { cancelled = true; img.onload = null; img.onerror = null; };
  }, [url, scope, shown]);

  return url && shown?.scope === scope ? shown?.url ?? null : null;
}
