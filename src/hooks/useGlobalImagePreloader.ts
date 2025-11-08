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

        // 2. Hämta ALLA profilbilder och cover images
        const { data: profiles } = await supabase
          .from('profiles')
          .select('profile_image_url, cover_image_url, video_url, company_logo_url, cv_url');

        if (profiles) {
          profiles.forEach(profile => {
            if (profile.profile_image_url) {
              if (profile.profile_image_url.includes('/storage/v1/object/public/')) {
                imagesToPreload.push(profile.profile_image_url);
              } else {
                const publicUrl = supabase.storage
                  .from('profile-media')
                  .getPublicUrl(profile.profile_image_url).data.publicUrl;
                if (publicUrl) imagesToPreload.push(publicUrl);
              }
            }
            if (profile.cover_image_url) imagesToPreload.push(profile.cover_image_url);
            if (profile.video_url) imagesToPreload.push(profile.video_url);
            if (profile.company_logo_url) imagesToPreload.push(profile.company_logo_url);
            if (profile.cv_url) imagesToPreload.push(profile.cv_url);
          });
        }

        // 3. Hämta ALLA företagslogotyper från company-logos bucket
        const { data: companyLogos } = await supabase
          .storage
          .from('company-logos')
          .list();

        if (companyLogos) {
          companyLogos.forEach(file => {
            const publicUrl = supabase.storage
              .from('company-logos')
              .getPublicUrl(file.name).data.publicUrl;
            if (publicUrl) imagesToPreload.push(publicUrl);
          });
        }

        // 4. Hämta ALLA ansökningsbilder och CV:er från job-applications bucket
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: applications } = await supabase
            .from('job_applications')
            .select('cv_url');

          if (applications) {
            applications.forEach(app => {
              if (app.cv_url) imagesToPreload.push(app.cv_url);
            });
          }
        }

        // 5. Starta förladdning via Service Worker
        if (imagesToPreload.length > 0) {
          console.log(`🚀 Preloading ${imagesToPreload.length} assets (ALL jobs, profiles, logos, CVs) in background...`);
          await preloadImages(imagesToPreload);
          console.log('✅ All assets preloaded and ready for offline use!');
        }
      } catch (error) {
        console.error('Failed to preload assets:', error);
      }
    };

    // Kör preload i bakgrunden efter en kort delay för att inte blockera initial render
    setTimeout(preloadCriticalImages, 1000);
  }, []);
};
