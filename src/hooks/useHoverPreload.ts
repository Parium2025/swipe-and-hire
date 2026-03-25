import { useCallback, useRef } from 'react';
import { imageCache } from '@/lib/imageCache';

/**
 * Hook för att förladdda bilder när användaren hovrar över ett element
 * Använder imageCache (blob-based) istället för native Image() för att
 * seeda samma cache som resten av systemet.
 */
export const useHoverPreload = () => {
  const preloadedRef = useRef(new Set<string>());

  const handleHoverPreload = useCallback((imageUrls: (string | null | undefined)[]) => {
    const validUrls = imageUrls.filter((url): url is string => {
      return !!url && !preloadedRef.current.has(url);
    });

    if (validUrls.length === 0) return;

    // Markera som påbörjad så vi inte laddar flera gånger
    validUrls.forEach(url => preloadedRef.current.add(url));

    // Starta preloading via imageCache (seedar blob-cache)
    imageCache.preloadImages(validUrls).catch(() => {
      // Om det misslyckas, ta bort från set så vi kan försöka igen
      validUrls.forEach(url => preloadedRef.current.delete(url));
    });
  }, []);

  return handleHoverPreload;
};
