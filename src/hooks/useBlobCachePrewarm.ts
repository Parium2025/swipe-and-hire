import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { imageCache } from '@/lib/imageCache';

/**
 * Pre-warm blob cache för en lista av kort INNAN användaren börjar
 * navigera mellan tabbar. Detta eliminerar `createObjectURL`-jobbet
 * (~72ms) under tab-switch eftersom alla blobs redan är allokerade.
 *
 * Körs i bakgrunden (idle-callback) så det blockerar aldrig render.
 */
type Bucket = 'job-images' | 'company-logos' | 'profile-images';

interface PrewarmEntry {
  path?: string | null;
  bucket: Bucket;
}

export function useBlobCachePrewarm(entries: PrewarmEntry[]) {
  useEffect(() => {
    if (entries.length === 0) return;

    const urls: string[] = [];
    for (const e of entries) {
      if (!e.path) continue;
      if (e.path.startsWith('http')) {
        urls.push(e.path);
      } else {
        const { data } = supabase.storage.from(e.bucket).getPublicUrl(e.path);
        if (data?.publicUrl) urls.push(data.publicUrl);
      }
    }

    if (urls.length === 0) return;

    // Prewarm i idle så vi aldrig konkurrerar med render
    const run = () => {
      imageCache.preloadImages(urls).catch(() => {});
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(run, { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 200);
    return () => window.clearTimeout(id);
  }, [entries]);
}
