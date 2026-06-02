import { useEffect, useMemo, useRef } from 'react';

interface ImagePreloaderOptions {
  priority?: 'high' | 'low';
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook för att förladdda bilder i bakgrunden
 * Skapar img-element som laddar bilderna utan att visa dem
 */
export const useImagePreloader = (urls: (string | null | undefined)[], options: ImagePreloaderOptions = {}) => {
  const { priority = 'low', onLoad, onError } = options;
  const loadedRef = useRef(new Set<string>());

  // Stabilisera arrayen så effekten inte triggas av ny array-referens varje render.
  const validUrls = useMemo(
    () => (urls || []).filter((u): u is string => typeof u === 'string' && u.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urls?.join('|')],
  );

  useEffect(() => {
    if (validUrls.length === 0) return;

    const newUrls = validUrls.filter(url => !loadedRef.current.has(url));

    if (newUrls.length === 0) return;


    const images: HTMLImageElement[] = [];

    newUrls.forEach((url) => {
      const img = new Image();
      
      // Sätt fetchPriority för bättre kontroll
      if (priority === 'high') {
        img.fetchPriority = 'high';
      }

      img.onload = () => {
        const markLoaded = () => {
          loadedRef.current.add(url);
          onLoad?.();
        };

        if (typeof img.decode === 'function') {
          img.decode().then(markLoaded).catch(markLoaded);
          return;
        }

        loadedRef.current.add(url);
        onLoad?.();
      };

      img.onerror = () => {
        console.warn(`Failed to preload image: ${url}`);
        onError?.(new Error(`Failed to load ${url}`));
      };

      // Starta laddningen
      img.src = url;
      images.push(img);
    });

    // Cleanup om komponenten unmountas
    return () => {
      images.forEach(img => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [urls, priority, onLoad, onError]);
};

/**
 * Preload en enskild bild direkt
 */
export const preloadImage = (url: string, priority: 'high' | 'low' = 'low'): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (priority === 'high') {
      img.fetchPriority = 'high';
    }
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(() => resolve()).catch(() => resolve());
        return;
      }
      resolve();
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
};

/**
 * Preload flera bilder samtidigt
 */
export const preloadImages = async (urls: string[], priority: 'high' | 'low' = 'low'): Promise<void> => {
  await Promise.all(urls.map(url => preloadImage(url, priority).catch(() => {
    // Ignorera fel, fortsätt ladda andra bilder
  })));
};
