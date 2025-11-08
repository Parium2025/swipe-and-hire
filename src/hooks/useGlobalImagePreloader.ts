import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { preloadImages, waitForServiceWorker } from '@/lib/serviceWorkerManager';

/**
 * Global hook som förladddar alla kritiska bilder vid app-start
 * Körs en gång när appen startar
 */
export const useGlobalImagePreloader = () => {
  useEffect(() => {
    const preloadCriticalImages = async () => {
      try {
        // Vänta på att service worker ska bli aktiv
        await waitForServiceWorker();

        const imagesToPreload: string[] = [];

        // 1. Hämta alla jobbbilder (max 50 senaste)
        const { data: jobs } = await supabase
          .from('job_postings')
          .select('job_image_url')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (jobs) {
          jobs.forEach(job => {
            if (job.job_image_url) {
              // Om det är en public URL, använd den direkt
              if (job.job_image_url.includes('/storage/v1/object/public/')) {
                imagesToPreload.push(job.job_image_url);
              } else {
                // Annars, generera public URL
                const publicUrl = supabase.storage
                  .from('job-images')
                  .getPublicUrl(job.job_image_url).data.publicUrl;
                if (publicUrl) imagesToPreload.push(publicUrl);
              }
            }
          });
        }

        // 2. Hämta användarens profilbilder om inloggad
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('profile_image_url, cover_image_url, video_url')
            .eq('id', user.id)
            .single();

          if (profile) {
            if (profile.profile_image_url) imagesToPreload.push(profile.profile_image_url);
            if (profile.cover_image_url) imagesToPreload.push(profile.cover_image_url);
            if (profile.video_url) imagesToPreload.push(profile.video_url);
          }
        }

        // 3. Starta förladdning via Service Worker
        if (imagesToPreload.length > 0) {
          console.log(`🚀 Preloading ${imagesToPreload.length} critical images in background...`);
          await preloadImages(imagesToPreload);
          console.log('✅ All critical images preloaded!');
        }
      } catch (error) {
        console.error('Failed to preload images:', error);
      }
    };

    // Kör preload i bakgrunden efter en kort delay för att inte blockera initial render
    setTimeout(preloadCriticalImages, 1000);
  }, []);
};
