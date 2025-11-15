import { useEffect } from 'react';
import { imageCache } from '@/lib/imageCache';

/**
 * Hook som aggressivt förladddar specifika bilder med högsta prioritet
 * Använd för bilder som MÅSTE vara redo innan de visas
 */
export const useAggressiveImagePreload = (urls: (string | null | undefined)[]) => {
  useEffect(() => {
    const validUrls = urls.filter((url): url is string => 
      !!url && url.trim() !== '' && !url.includes('undefined')
    );

    if (validUrls.length === 0) return;

    // Starta preload omedelbart med högsta prioritet
    const preload = async () => {
      try {
        // Ladda alla bilder parallellt i imageCache
        await Promise.all(
          validUrls.map(url => 
            imageCache.loadImage(url).catch(err => {
              console.warn(`Preload failed for ${url}:`, err);
            })
          )
        );
        console.log(`✅ Aggressively preloaded ${validUrls.length} images`);
      } catch (error) {
        console.error('Aggressive preload error:', error);
      }
    };

    preload();

    // Refresh preload varje 10 sekunder för att hålla cache fräsch
    const interval = setInterval(preload, 10000);

    return () => clearInterval(interval);
  }, [urls.join(',')]);
};
