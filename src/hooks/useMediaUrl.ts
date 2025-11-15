import { useEffect, useState, useRef } from 'react';
import { getMediaUrl, type MediaType } from '@/lib/mediaManager';
import { imageCache } from '@/lib/imageCache';

// In-memory cache för signed URLs (överlever re-renders)
const signedUrlMemoryCache = new Map<string, { url: string; expiresAt: number }>();

// LocalStorage cache key
const getCacheKey = (storagePath: string, mediaType: MediaType) => 
  `media_url_${mediaType}_${storagePath}`;

export function useMediaUrl(storagePath: string | null | undefined, mediaType: MediaType, expiresInSeconds: number = 86400) {
  // Försök hämta cached blob URL direkt (INSTANT, no flicker)
  const initialBlobUrl = storagePath ? imageCache.getCachedUrl(storagePath) : null;
  
  const [url, setUrl] = useState<string | null>(initialBlobUrl);
  const [isLoading, setIsLoading] = useState(!initialBlobUrl && !!storagePath);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!storagePath) {
      setUrl(null);
      setIsLoading(false);
      return;
    }

    // Undvik dubbel-laddning
    if (loadingRef.current) return;

    const cacheKey = getCacheKey(storagePath, mediaType);
    
    // 1. Kolla om vi redan har en blob URL i imageCache (SNABBAST)
    const cachedBlobUrl = imageCache.getCachedUrl(storagePath);
    if (cachedBlobUrl) {
      setUrl(cachedBlobUrl);
      setIsLoading(false);
      return;
    }

    // 2. Kolla memory cache för signed URL
    const memCached = signedUrlMemoryCache.get(cacheKey);
    const now = Date.now();
    if (memCached && memCached.expiresAt > now) {
      // Använd signed URL medan blob laddas i bakgrunden
      setUrl(memCached.url);
      setIsLoading(false);
      
      // Ladda blob i bakgrunden för nästa gång
      imageCache.loadImage(memCached.url).catch(console.error);
      return;
    }

    // 3. Kolla localStorage för signed URL
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt > now) {
          setUrl(parsed.url);
          setIsLoading(false);
          signedUrlMemoryCache.set(cacheKey, parsed);
          
          // Ladda blob i bakgrunden
          imageCache.loadImage(parsed.url).catch(console.error);
          return;
        } else {
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (e) {
      console.error('Cache read error:', e);
    }

    // 4. Ingen cache finns, generera ny signed URL
    loadingRef.current = true;
    setIsLoading(true);

    (async () => {
      try {
        const signedUrl = await getMediaUrl(storagePath, mediaType, expiresInSeconds);
        
        if (!signedUrl) {
          setUrl(null);
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }

        // Cacha signed URL (expires 80% av faktisk expire tid för säkerhet)
        const expiresAt = now + (expiresInSeconds * 1000 * 0.8);
        const cacheData = { url: signedUrl, expiresAt };
        
        signedUrlMemoryCache.set(cacheKey, cacheData);
        
        try {
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
          console.warn('LocalStorage cache failed:', e);
        }

        // Visa signed URL direkt (no flicker)
        setUrl(signedUrl);
        setIsLoading(false);

        // Ladda blob i bakgrunden för ännu snabbare framtida laddning
        imageCache.loadImage(signedUrl)
          .then(blobUrl => {
            // Uppdatera till blob URL när den är redo (smooth upgrade)
            setUrl(blobUrl);
          })
          .catch(console.error);

      } catch (e) {
        console.error('Failed to get media URL:', e);
        setUrl(null);
        setIsLoading(false);
      } finally {
        loadingRef.current = false;
      }
    })();

  }, [storagePath, mediaType, expiresInSeconds]);

  return url;
}

// Utility för att rensa utgångna cache-poster
export function clearExpiredMediaCache() {
  const now = Date.now();
  
  // Rensa memory cache
  for (const [key, value] of signedUrlMemoryCache.entries()) {
    if (value.expiresAt <= now) {
      signedUrlMemoryCache.delete(key);
    }
  }
  
  // Rensa localStorage cache
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('media_url_')) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.expiresAt <= now) {
            keysToRemove.push(key);
          }
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    console.error('Cache cleanup error:', e);
  }
}

// Kör cleanup vid app start
if (typeof window !== 'undefined') {
  clearExpiredMediaCache();
  // Kör cleanup varje 10 minuter
  setInterval(clearExpiredMediaCache, 10 * 60 * 1000);
}
