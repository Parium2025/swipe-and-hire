import { useCallback, useRef } from 'react';
import { preloadImages } from './useImagePreloader';

/**
 * Hook för att förladdda bilder när användaren hovrar över ett element
 * Perfekt för jobbkort - ladda bilden innan användaren klickar
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

    // Starta preloading med hög prioritet vid hover
    preloadImages(validUrls, 'high').catch(() => {
      // Om det misslyckas, ta bort från cache så vi kan försöka igen
      validUrls.forEach(url => preloadedRef.current.delete(url));
    });
  }, []);

  return handleHoverPreload;
};
