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

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const container = document.querySelector('[data-main-scroll-container="true"]');
      if (container?.hasAttribute('data-page-change-active')) return;
      imageCache.preloadImages(urls).catch(() => {});
    };

    const runAfterPageChange = () => run();
    window.addEventListener('parium:page-change-complete', runAfterPageChange);

    if (immediate) {
      run();
      return () => {
        cancelled = true;
        window.removeEventListener('parium:page-change-complete', runAfterPageChange);
      };
    }

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(run, { timeout: 1500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
        window.removeEventListener('parium:page-change-complete', runAfterPageChange);
      };
    }
    const id = window.setTimeout(run, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      window.removeEventListener('parium:page-change-complete', runAfterPageChange);
    };
  }, [entries, immediate]);
}
