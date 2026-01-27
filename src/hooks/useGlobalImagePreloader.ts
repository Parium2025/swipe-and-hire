import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { preloadImages, waitForServiceWorker } from '@/lib/serviceWorkerManager';
import { getMediaUrl } from '@/lib/mediaManager';
import pariumLogoRings from '@/assets/parium-logo-rings.png';

/**
 * Global hook som förladddar alla kritiska bilder vid app-start
 * Körs en gång när appen startar
 * PRIORITERAR inloggad användares media FÖRST för omedelbar sidebar-visning
 */
export const useGlobalImagePreloader = () => {
  useEffect(() => {
    const preloadCriticalImages = async () => {
      try {
        // Vänta på service worker endast i produktion
        if (import.meta.env.PROD) {
          await waitForServiceWorker();
        }

        const imagesToPreload: string[] = [];
        
        // 🔥 PRIORITET 0: Ladda Parium-logotypen FÖRST (samma bundle-path som navigationen använder)
        console.log('🚀 HIGHEST PRIORITY: Preloading Parium logo...');
        await preloadImages([pariumLogoRings]);
        console.log('✅ Parium logo preloaded and ready!');
        
        // 🔥 PRIORITET 1: Ladda inloggad användares profilmedia FÖRST
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('profile_image_url, cover_image_url, video_url')
            .eq('user_id', user.id)
            .single();
          
          if (currentProfile) {
            // Generera signed URLs för användarens media och förladdda OMEDELBART
            const userMedia: string[] = [];
            
            if (currentProfile.profile_image_url) {
              const url = await getMediaUrl(currentProfile.profile_image_url, 'profile-image', 86400);
              if (url) userMedia.push(url);
            }
            
            if (currentProfile.cover_image_url) {
              const url = await getMediaUrl(currentProfile.cover_image_url, 'cover-image', 86400);
              if (url) userMedia.push(url);
            }
            
            if (currentProfile.video_url) {
              const url = await getMediaUrl(currentProfile.video_url, 'profile-video', 86400);
              if (url) userMedia.push(url);
            }
            
            // Förladdda användarens media FÖRST med högsta prioritet
            if (userMedia.length > 0) {
              console.log(`🚀 PRIORITY: Preloading current user's media (${userMedia.length} items)...`);
              await preloadImages(userMedia);
              console.log('✅ User media preloaded and ready!');
            }
          }
        }

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
            // Profile/Cover/Video media kan ligga i private bucket (job-applications) och kräver signed URL.
            // Vi förladdar därför bara media som redan är publika URLs här (för att undvika felaktiga fetches).
            if (profile.profile_image_url?.includes('/storage/v1/object/public/')) {
              imagesToPreload.push(profile.profile_image_url.split('?')[0]);
            }

            if (profile.cover_image_url?.includes('/storage/v1/object/public/')) {
              imagesToPreload.push(profile.cover_image_url.split('?')[0]);
            }

            if (profile.video_url?.includes('/storage/v1/object/public/')) {
              imagesToPreload.push(profile.video_url.split('?')[0]);
            }
            
            // Company logos - redan publika URLs i profiles-tabellen
            if (profile.company_logo_url) {
              const cleanUrl = profile.company_logo_url.split('?')[0];
              imagesToPreload.push(cleanUrl);
            }
          });
        }

        // 3. Starta förladdning av ÖVRIG media i bakgrunden (lägre prioritet)
        if (imagesToPreload.length > 0) {
          console.log(`🚀 Preloading ${imagesToPreload.length} additional assets (jobs, other profiles) in background...`);
          // Använd requestIdleCallback för att inte blockera huvudtråden
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              preloadImages(imagesToPreload);
            });
          } else {
            setTimeout(() => {
              preloadImages(imagesToPreload);
            }, 100);
          }
        }
      } catch (error) {
        console.error('Failed to preload assets:', error);
      }
    };

    // Kör preload direkt vid app-start för minimal first-navigation-latens
    preloadCriticalImages();
  }, []);
};
