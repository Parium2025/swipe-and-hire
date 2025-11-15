import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { preloadImages, waitForServiceWorker } from '@/lib/serviceWorkerManager';
import { imageCache } from '@/lib/imageCache';

/**
 * Global hook som förladddar alla kritiska bilder vid app-start
 * Körs kontinuerligt för att hålla alla bilder redo
 */
export const useGlobalImagePreloader = () => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const preloadCriticalImages = async () => {
      try {
        // Vänta på service worker endast i produktion
        if (import.meta.env.PROD) {
          await waitForServiceWorker();
        }

        const imagesToPreload: string[] = [];

        // 1. Hämta ALLA jobbbilder
        const { data: jobs } = await supabase
          .from('job_postings')
          .select('job_image_url')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (jobs) {
          jobs.forEach(job => {
            if (job.job_image_url) {
              if (job.job_image_url.includes('/storage/v1/object/public/')) {
                imagesToPreload.push(job.job_image_url);
              } else {
                const publicUrl = supabase.storage
                  .from('job-images')
                  .getPublicUrl(job.job_image_url).data.publicUrl;
                if (publicUrl) imagesToPreload.push(publicUrl);
              }
            }
          });
        }

        // 2. Hämta ALLA profilbilder, cover images, videos och company logos
        const { data: profiles } = await supabase
          .from('profiles')
          .select('profile_image_url, cover_image_url, video_url, company_logo_url');

        if (profiles) {
          profiles.forEach(profile => {
            // Profile images - konvertera storage-paths till publika URLs från profile-media
            if (profile.profile_image_url) {
              if (profile.profile_image_url.includes('/storage/v1/object/public/')) {
                imagesToPreload.push(profile.profile_image_url.split('?')[0]);
              } else {
                const publicUrl = supabase.storage
                  .from('profile-media')
                  .getPublicUrl(profile.profile_image_url).data.publicUrl;
                if (publicUrl) imagesToPreload.push(publicUrl);
              }
            }
            
            // Cover images - konvertera storage-paths till publika URLs från profile-media
            if (profile.cover_image_url) {
              if (profile.cover_image_url.includes('/storage/v1/object/public/')) {
                imagesToPreload.push(profile.cover_image_url.split('?')[0]);
              } else {
                const publicUrl = supabase.storage
                  .from('profile-media')
                  .getPublicUrl(profile.cover_image_url).data.publicUrl;
                if (publicUrl) imagesToPreload.push(publicUrl);
              }
            }
            
            // Videos - konvertera storage-paths till publika URLs från profile-media
            if (profile.video_url) {
              if (profile.video_url.includes('/storage/v1/object/public/')) {
                imagesToPreload.push(profile.video_url.split('?')[0]);
              } else {
                const publicUrl = supabase.storage
                  .from('profile-media')
                  .getPublicUrl(profile.video_url).data.publicUrl;
                if (publicUrl) imagesToPreload.push(publicUrl);
              }
            }
            
            // Company logos - redan publika URLs i profiles-tabellen
            if (profile.company_logo_url) {
              const cleanUrl = profile.company_logo_url.split('?')[0];
              imagesToPreload.push(cleanUrl);
            }
          });
        }

        // 3. Ladda ALLT i imageCache först (högsta prioritet)
        if (imagesToPreload.length > 0) {
          console.log(`🚀 Aggressively preloading ${imagesToPreload.length} assets in memory cache...`);
          
          // Ladda i imageCache för omedelbar tillgång
          await imageCache.preloadImages(imagesToPreload);
          console.log('✅ All assets cached in memory!');
          
          // Sedan ladda i Service Worker för offline
          if (import.meta.env.PROD) {
            await preloadImages(imagesToPreload);
            console.log('✅ All assets cached in Service Worker!');
          }
        }
      } catch (error) {
        console.error('Failed to preload assets:', error);
      }
    };

    // Kör preload direkt vid app-start
    preloadCriticalImages();
    
    // Uppdatera cache var 30:e sekund för att hålla den fräsch
    intervalRef.current = setInterval(() => {
      preloadCriticalImages();
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
};
