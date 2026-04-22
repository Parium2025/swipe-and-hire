import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { imageCache } from '@/lib/imageCache';
import { appendVersionToUrl } from '@/lib/versionedMediaUrl';

interface PreloadableJob {
  job_image_url?: string;
  company_logo_url?: string;
  updated_at?: string;
}

function resolveUrl(url: string | undefined, bucket: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const { data } = supabase.storage.from(bucket).getPublicUrl(url);
  return data?.publicUrl || null;
}

/**
 * Premium image preloader for swipe stack.
 * - Looks ahead `lookahead` cards (default 10) for upcoming jobs
 * - Looks back `lookbehind` cards (default 2) to support undo
 * - Preloads BOTH job image and company logo into blob cache
 * - On first run, also bulk-preloads `initialBulk` jobs (default 25) to guarantee
 *   the start of the session is buttery smooth
 *
 * Pure cache logic — no UI side effects.
 */
export function useSwipeImagePreloader(
  jobs: PreloadableJob[],
  currentIndex: number,
  lookahead = 10,
  lookbehind = 2,
  initialBulk = 25,
) {
  const loadedRef = useRef(new Set<string>());
  const didBulkRef = useRef(false);

  // One-time bulk preload as soon as the list is available.
  // 🚀 LOGOS: laddas OMEDELBART (parallellt, inte idle) — små filer (5-20 KB),
  //    ofta återanvända per företag. Ingen flicker när användaren öppnar swipe.
  // 🖼️ JOB-IMAGES: bulk-preloada första `initialBulk` via idle callback
  //    (stora filer 200-800 KB — vi vill inte saturera nätverket eller blockera).
  useEffect(() => {
    if (didBulkRef.current) return;
    if (!jobs || jobs.length === 0) return;
    didBulkRef.current = true;

    // ── 1. LOGOS: kör DIREKT (high priority, parallellt) ──
    const logoUrls: string[] = [];
    for (let i = 0; i < jobs.length; i++) {
      const logoUrl = appendVersionToUrl(resolveUrl(jobs[i].company_logo_url, 'company-logos'), jobs[i].updated_at);
      if (logoUrl && !loadedRef.current.has(logoUrl)) {
        loadedRef.current.add(logoUrl);
        logoUrls.push(logoUrl);
      }
    }
    // Logos är små → kan köras alla parallellt utan att saturera nätverket
    logoUrls.forEach(u => { imageCache.loadImage(u).catch(() => {}); });

    // ── 2. JOB-IMAGES: kör via idle callback i batchar ──
    const imgUrls: string[] = [];
    const upper = Math.min(initialBulk, jobs.length);
    for (let i = 0; i < upper; i++) {
      const imgUrl = appendVersionToUrl(resolveUrl(jobs[i].job_image_url, 'job-images'), jobs[i].updated_at);
      if (imgUrl && !loadedRef.current.has(imgUrl)) {
        loadedRef.current.add(imgUrl);
        imgUrls.push(imgUrl);
      }
    }

    if (imgUrls.length === 0) return;

    const run = () => {
      const batchSize = 6;
      let i = 0;
      const next = () => {
        if (i >= imgUrls.length) return;
        const batch = imgUrls.slice(i, i + batchSize);
        i += batchSize;
        Promise.allSettled(batch.map(u => imageCache.loadImage(u))).finally(next);
      };
      next();
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 500 });
    } else {
      setTimeout(run, 50);
    }
  }, [jobs, initialBulk]);

  // Rolling window preload around the current index
  useEffect(() => {
    if (!jobs || jobs.length === 0) return;

    const urls: string[] = [];
    const start = Math.max(0, currentIndex - lookbehind);
    const end = Math.min(currentIndex + lookahead, jobs.length - 1);

    for (let i = start; i <= end; i++) {
      if (i === currentIndex) continue; // current is already loaded
      const job = jobs[i];
      const imgUrl = appendVersionToUrl(resolveUrl(job.job_image_url, 'job-images'), job.updated_at);
      const logoUrl = appendVersionToUrl(resolveUrl(job.company_logo_url, 'company-logos'), job.updated_at);
      if (imgUrl && !loadedRef.current.has(imgUrl)) urls.push(imgUrl);
      if (logoUrl && !loadedRef.current.has(logoUrl)) urls.push(logoUrl);
    }

    urls.forEach(url => {
      loadedRef.current.add(url);
      imageCache.loadImage(url).catch(() => {
        // fallback: still warm the browser cache
        const img = new Image();
        img.src = url;
      });
    });
  }, [jobs, currentIndex, lookahead, lookbehind]);
}
