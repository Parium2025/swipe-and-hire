import { useState, useEffect } from 'react';
import { imageCache } from '@/lib/imageCache';

/**
 * Hook för att använda cachade bilder
 * Returnerar en blob URL som är permanent cachad
 */
export const useCachedImage = (url: string | null | undefined) => {
  const [cachedUrl, setCachedUrl] = useState<string | null>(() => {
    if (!url) return null;
    // Försök hämta från cache direkt
    return imageCache.getCachedUrl(url);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) {
      setCachedUrl(null);
      return;
    }

    // Om redan cachad, använd direkt
    const cached = imageCache.getCachedUrl(url);
    if (cached) {
      setCachedUrl(cached);
      return;
    }

    // Annars ladda och cacha
    setLoading(true);
    setError(null);

    imageCache.loadImage(url)
      .then(objectUrl => {
        setCachedUrl(objectUrl);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
        // Fallback till original URL vid fel
        setCachedUrl(url);
      });
  }, [url]);

  return { cachedUrl: cachedUrl || url, loading, error };
};

/**
 * Hook för att förladdda flera bilder
 */
export const usePreloadImages = (urls: (string | null | undefined)[]) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const validUrls = urls.filter((url): url is string => !!url && url.trim() !== '');
    
    if (validUrls.length === 0) {
      setLoaded(true);
      return;
    }

    imageCache.preloadImages(validUrls)
      .then(() => setLoaded(true))
      .catch(() => setLoaded(true)); // Fortsätt även vid fel
  }, [urls]);

  return loaded;
};
