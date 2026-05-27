import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { imageCache } from '@/lib/imageCache';
import { appendVersionToUrl } from '@/lib/versionedMediaUrl';
// Import logo directly so it's bundled and we get the hashed URL
import pariumLogoRings from '@/assets/parium-logo-rings.png';

/**
 * Preload an image using native Image() - most reliable method
 * Returns immediately when image is in browser cache
 */
const preloadImageNative = (src: string): Promise<void> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Don't block on error
    img.src = src;
  });
};

// MUST match the transforms in SearchJobs.tsx / JobView.tsx so cache keys align.
const JOB_CARD_TRANSFORM = { width: 600, height: 400, quality: 75, resize: 'cover' as const };
const JOB_VIEW_HERO_TRANSFORM = { width: 1200, height: 800, quality: 75, resize: 'cover' as const };
const COMPANY_LOGO_TRANSFORM = { width: 128, height: 128, quality: 80, resize: 'contain' as const };

const IDLE_WARM_JOB_COUNT = 20; // upper bound — kept conservative for mobile data
const IDLE_BATCH_SIZE = 4;

function getPublicUrlSafe(bucket: 'job-images' | 'company-logos', path: string, transform: any): string | null {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path, { transform });
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

function warmInBatches(urls: string[]) {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return;
  let i = 0;
  const next = () => {
    if (i >= unique.length) return;
    const batch = unique.slice(i, i + IDLE_BATCH_SIZE);
    i += IDLE_BATCH_SIZE;
    Promise.allSettled(batch.map((u) => imageCache.loadImage(u))).finally(() => {
      // Yield back to idle so we never block interaction
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(next, { timeout: 1500 });
      } else {
        setTimeout(next, 100);
      }
    });
  };
  next();
}

/**
 * Global hook som förladddar KRITISKA bilder vid app-start och sedan
 * fortsätter värma upp aktiva jobb i bakgrunden via idle callbacks så att
 * upplevelsen alltid känns "redan laddad" — Spotify-style.
 *
 * Pipeline:
 *  - PRIORITET 0: Parium-logo (splash/auth)
 *  - PRIORITET 1: Inloggad användares profilmedia (sidebar)
 *  - PRIORITET 2 (idle): topp ~20 aktiva jobb → kort-thumbnail + JobView-hero + logo
 */
export const useGlobalImagePreloader = (enabled: boolean = true) => {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (startedRef.current) return;
    startedRef.current = true;

    const preloadCriticalImages = async () => {
      try {
        // 🔥 PRIORITET 0: Parium-logotypen
        await preloadImageNative(pariumLogoRings);

        // 🔥 PRIORITET 1: Inloggad användares profilmedia
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('profile_image_url, cover_image_url, video_url')
          .eq('user_id', user.id)
          .single();

        if (currentProfile) {
          const tasks: Promise<void>[] = [];
          if (currentProfile.profile_image_url) tasks.push(prefetchMediaUrl(currentProfile.profile_image_url, 'profile-image'));
          if (currentProfile.cover_image_url) tasks.push(prefetchMediaUrl(currentProfile.cover_image_url, 'cover-image'));
          if (currentProfile.video_url) tasks.push(prefetchMediaUrl(currentProfile.video_url, 'profile-video'));
          if (tasks.length > 0) await Promise.allSettled(tasks);
        }

        // 🟢 PRIORITET 2: Idle warm-up av topp aktiva jobb i bakgrunden.
        // Körs alltid medan användaren är inloggad — så listor, swipe och
        // JobView öppnas instant utan att blockera UI.
        const scheduleIdleWarm = () => {
          const run = async () => {
            try {
              const { data: jobs } = await supabase
                .from('job_postings')
                .select('id, job_image_url, job_image_desktop_url, company_logo_url, updated_at')
                .eq('is_active', true)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(IDLE_WARM_JOB_COUNT);

              if (!jobs || jobs.length === 0) return;

              const urls: string[] = [];
              for (const job of jobs) {
                const v = (job as any).updated_at;
                if (job.job_image_url && !job.job_image_url.startsWith('http')) {
                  const card = appendVersionToUrl(getPublicUrlSafe('job-images', job.job_image_url, JOB_CARD_TRANSFORM), v);
                  const hero = appendVersionToUrl(getPublicUrlSafe('job-images', job.job_image_url, JOB_VIEW_HERO_TRANSFORM), v);
                  if (card) urls.push(card);
                  if (hero) urls.push(hero);
                }
                if (job.job_image_desktop_url && !job.job_image_desktop_url.startsWith('http')) {
                  const hero = appendVersionToUrl(getPublicUrlSafe('job-images', job.job_image_desktop_url, JOB_VIEW_HERO_TRANSFORM), v);
                  if (hero) urls.push(hero);
                }
                if (job.company_logo_url && !job.company_logo_url.startsWith('http')) {
                  const logo = getPublicUrlSafe('company-logos', job.company_logo_url, COMPANY_LOGO_TRANSFORM);
                  if (logo) urls.push(logo);
                }
              }

              warmInBatches(urls);
            } catch {
              // tyst — bakgrundsvärmning får aldrig störa UX
            }
          };

          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(run, { timeout: 3000 });
          } else {
            setTimeout(run, 1500);
          }
        };

        scheduleIdleWarm();
      } catch (error) {
        console.error('Failed to preload critical assets:', error);
      }
    };

    preloadCriticalImages();
  }, [enabled]);
};
