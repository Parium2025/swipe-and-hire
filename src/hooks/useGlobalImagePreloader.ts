import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { waitForServiceWorker } from '@/lib/serviceWorkerManager';
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
 * Global hook som förladddar KRITISKA bilder vid app-start.
 *
 * 🔁 KONSOLIDERING (steg 2): Tidigare laddade vi även 50 jobbilder + 50 logos
 *    här vid varje login. Det är dubbelt jobb — `useSwipeImagePreloader` laddar
 *    EXAKT samma data on-demand när användaren faktiskt öppnar swipe (logos
 *    omedelbart, jobbilder via idle callback i batchar). Och små logos
 *    persisteras ändå i IndexedDB av `imageCache` så de finns vid återbesök.
 *
 *    Resultat av att ta bort dem här: ~50 MB mindre nätverk + ~150 MB mindre
 *    minne per login. Noll synlig skillnad för användaren.
 *
 * Vi behåller endast:
 *  - PRIORITET 0: Parium-logo (visas direkt vid splash/auth)
 *  - PRIORITET 1: Inloggad användares profilmedia (sidebar avatar/video)
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
        await preloadImageNative(pariumLogoRings);

        // Vänta på service worker endast i produktion (för övriga assets)
        if (import.meta.env.PROD) {
          await waitForServiceWorker();
        }

        // 🔥 PRIORITET 1: Ladda inloggad användares profilmedia
        // (sidebaren visar avatar/video direkt efter login)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('profile_image_url, cover_image_url, video_url')
          .eq('user_id', user.id)
          .single();

        if (!currentProfile) return;

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
          await Promise.allSettled(tasks);
        }
      } catch (error) {
        console.error('Failed to preload critical assets:', error);
      }
    };

    preloadCriticalImages();
  }, [enabled]);
};
