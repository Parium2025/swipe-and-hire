import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { imageCache } from '@/lib/imageCache';

/**
 * 🔁 Unified image prewarm hook
 *
 * Ersätter (och konsoliderar):
 *  - useBlobCachePrewarm (path + bucket → resolve + prewarm i idle)
 *  - useHoverPreload     (färdiga URL:er, prewarm omedelbart)
 *
 * Båda gjorde samma sak: seedade `imageCache` blob-cache så att bilder
 * renderas instant nästa gång de visas. Skillnaden var bara hur input
 * ser ut + tajming. Det här hook:et accepterar bägge formerna.
 *
 * Säkerhet:
 *  - Ren cache-hook, INGA UI-bieffekter
 *  - Misslyckade fetches är tysta (catch noop)
 *  - Default: idle-callback så vi aldrig konkurrerar med render
 */

type Bucket = 'job-images' | 'company-logos' | 'profile-images';

export interface PrewarmEntry {
  /** Antingen path i bucket ELLER full http(s)-URL */
  path?: string | null;
  /** Krävs om path inte är full URL */
  bucket?: Bucket;
}

interface PrewarmOptions {
  /** Kör direkt istället för i idle-callback (för hover/touch-prefetch) */
  immediate?: boolean;
}

function resolveUrls(entries: PrewarmEntry[]): string[] {
  const urls: string[] = [];
  for (const e of entries) {
    if (!e.path) continue;
    if (e.path.startsWith('http')) {
      urls.push(e.path);
    } else if (e.bucket) {
      const { data } = supabase.storage.from(e.bucket).getPublicUrl(e.path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
  }
  return urls;
}

export function useImagePrewarm(entries: PrewarmEntry[], options: PrewarmOptions = {}) {
  const { immediate = false } = options;

  useEffect(() => {
    if (!entries || entries.length === 0) return;
    const urls = resolveUrls(entries);
    if (urls.length === 0) return;

    const run = () => {
      imageCache.preloadImages(urls).catch(() => {});
    };

    if (immediate) {
      run();
      return;
    }

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
  }, [entries, immediate]);
}
