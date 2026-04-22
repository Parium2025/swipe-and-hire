import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { waitForServiceWorker } from '@/lib/serviceWorkerManager';
import { getMediaUrl } from '@/lib/mediaManager';
import { imageCache } from '@/lib/imageCache';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
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

/**
 * Hur många jobb/företag vi maximalt preloadar vid app-start.
 *
 * VIKTIGT: Tidigare hämtade vi HELA tabellen vid varje login (fetchAllRows)
 * vilket gjorde att en login med 10k aktiva jobb laddade ~500 MB i bakgrunden
 * — varav 90% aldrig visades. Vi cachar bara LRU-200 ändå, så all preload
 * utöver det evictas omedelbart.
 *
 * Resten preloadas on-demand av useSwipeImagePreloader när användaren
 * faktiskt börjar swipa/scrolla.
 */
const PRELOAD_JOBS_LIMIT = 50;
const PRELOAD_LOGOS_LIMIT = 50;

/**
 * Global hook som förladddar alla kritiska bilder vid app-start
 * Körs en gång när appen startar
 * PRIORITERAR inloggad användares media FÖRST för omedelbar sidebar-visning
 * 
 * Använder prefetchMediaUrl för att seeda BOTH signed-url-cache OCH blob-cache
 * så att bilder renderas instant vid navigation.
 */
export const useGlobalImagePreloader = (enabled: boolean = true) => {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (startedRef.current) return;
    startedRef.current = true;

    const preloadCriticalImages = async () => {
      try {
        // 🔥 PRIORITET 0: Ladda Parium-logotypen OMEDELBART med native Image()
        console.log('🚀 HIGHEST PRIORITY: Preloading Parium logo (native)...');
        await preloadImageNative(pariumLogoRings);
        console.log('✅ Parium logo preloaded and ready!');
        
        // Vänta på service worker endast i produktion (för övriga assets)
        if (import.meta.env.PROD) {
          await waitForServiceWorker();
        }

        // 🔥 PRIORITET 1: Ladda inloggad användares profilmedia FÖRST
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('profile_image_url, cover_image_url, video_url')
            .eq('user_id', user.id)
            .single();
          
          if (currentProfile) {
            const tasks: Promise<void>[] = [];
            
            if (currentProfile.profile_image_url) {
              tasks.push(prefetchMediaUrl(currentProfile.profile_image_url, 'profile-image'));
            }
            if (currentProfile.cover_image_url) {
              tasks.push(prefetchMediaUrl(currentProfile.cover_image_url, 'cover-image'));
            }
            if (currentProfile.video_url) {
              tasks.push(prefetchMediaUrl(currentProfile.video_url, 'profile-video'));
            }
            
            if (tasks.length > 0) {
              console.log(`🚀 PRIORITY: Preloading current user's media (${tasks.length} items)...`);
              await Promise.allSettled(tasks);
              console.log('✅ User media preloaded and ready!');
            }
          }
        }

        // 🔥 PRIORITET 2: Senaste jobbbilderna (public bucket - ingen signering)
        // Begränsat till PRELOAD_JOBS_LIMIT — resten preloadas on-demand av
        // useSwipeImagePreloader när användaren faktiskt swipar.
        const { data: allJobs } = await supabase
          .from('job_postings')
          .select('job_image_url')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(PRELOAD_JOBS_LIMIT);

        const jobImageUrls: string[] = [];
        if (allJobs) {
          allJobs.forEach(job => {
            if (job.job_image_url) {
              if (job.job_image_url.includes('/storage/v1/object/public/')) {
                jobImageUrls.push(job.job_image_url.split('?')[0]);
              } else {
                const publicUrl = supabase.storage
                  .from('job-images')
                  .getPublicUrl(job.job_image_url).data.publicUrl;
                if (publicUrl) jobImageUrls.push(publicUrl);
              }
            }
          });
        }

        // Preload jobbbilder till blob-cache (public URLs, kan laddas direkt)
        if (jobImageUrls.length > 0) {
          console.log(`🚀 Preloading ${jobImageUrls.length} job images into blob cache...`);
          const preloadInBatches = async (urls: string[], batchSize: number) => {
            for (let i = 0; i < urls.length; i += batchSize) {
              const batch = urls.slice(i, i + batchSize);
              await Promise.allSettled(batch.map(url => imageCache.loadImage(url).catch(() => {})));
            }
          };
          
          // Kör i idle callback för att inte blockera UI
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              preloadInBatches(jobImageUrls, 10);
            });
          } else {
            setTimeout(() => {
              preloadInBatches(jobImageUrls, 10);
            }, 100);
          }
        }

        // 🔥 PRIORITET 3: Företagslogotyper (public bucket) — begränsat antal
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('company_logo_url')
          .not('company_logo_url', 'is', null)
          .limit(PRELOAD_LOGOS_LIMIT);

        const logoUrls: string[] = [];
        if (allProfiles) {
          allProfiles.forEach(profile => {
            if (profile.company_logo_url) {
              const raw = profile.company_logo_url;
              if (raw.startsWith('http')) {
                logoUrls.push(raw.split('?')[0]);
              } else {
                const publicUrl = supabase.storage
                  .from('company-logos')
                  .getPublicUrl(raw).data.publicUrl;
                if (publicUrl) logoUrls.push(publicUrl);
              }
            }
          });
        }

        if (logoUrls.length > 0) {
          console.log(`🚀 Preloading ${logoUrls.length} company logos...`);
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              imageCache.preloadImages(logoUrls);
            });
          } else {
            setTimeout(() => {
              imageCache.preloadImages(logoUrls);
            }, 200);
          }
        }

      } catch (error) {
        console.error('Failed to preload assets:', error);
      }
    };

    // Kör preload direkt vid app-start för minimal first-navigation-latens
    preloadCriticalImages();
  }, [enabled]);
};
