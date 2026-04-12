import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { imageCache } from '@/lib/imageCache';

interface PreloadableJob {
  job_image_url?: string;
  company_logo_url?: string;
}

function resolveUrl(url: string | undefined, bucket: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const { data } = supabase.storage.from(bucket).getPublicUrl(url);
  return data?.publicUrl || null;
}

/**
 * Preloads images for the next N cards in the swipe stack.
 * Runs whenever currentIndex changes, loading ahead of the user.
 */
export function useSwipeImagePreloader(
  jobs: PreloadableJob[],
  currentIndex: number,
  lookahead = 3,
) {
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    const urls: string[] = [];

    for (let i = currentIndex + 1; i <= Math.min(currentIndex + lookahead, jobs.length - 1); i++) {
      const job = jobs[i];
      const imgUrl = resolveUrl(job.job_image_url, 'job-images');
      const logoUrl = resolveUrl(job.company_logo_url, 'company-logos');

      if (imgUrl && !loadedRef.current.has(imgUrl)) urls.push(imgUrl);
      if (logoUrl && !loadedRef.current.has(logoUrl)) urls.push(logoUrl);
    }

    // Fire-and-forget preloading
    urls.forEach(url => {
      loadedRef.current.add(url);
      // Use imageCache which stores as blob for instant rendering
      imageCache.loadImage(url).catch(() => {
        // If blob cache fails, fallback to basic <img> preload
        const img = new Image();
        img.src = url;
      });
    });
  }, [jobs, currentIndex, lookahead]);
}
