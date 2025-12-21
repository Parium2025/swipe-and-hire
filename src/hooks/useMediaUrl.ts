import { useEffect, useState, useRef, useMemo } from 'react';
import { getMediaUrl, type MediaType } from '@/lib/mediaManager';
import { imageCache } from '@/lib/imageCache';

// In-memory cache för signed URLs (överlever re-renders och tab switches)
const signedUrlMemoryCache = new Map<string, { url: string; expiresAt: number }>();

// Track pågående laddningar globalt för att undvika duplicerade requests
const ongoingLoads = new Set<string>();

// LocalStorage cache key
const getCacheKey = (storagePath: string, mediaType: MediaType) => 
  `media_url_${mediaType}_${storagePath}`;

// Hämta cached URL synkront (för initial render utan flicker)
function getCachedUrlSync(storagePath: string, mediaType: MediaType): string | null {
  // 1. Kolla blob cache först (snabbast)
  const blobUrl = imageCache.getCachedUrl(storagePath);
  if (blobUrl) return blobUrl;
  
  // 2. Kolla memory cache
  const cacheKey = getCacheKey(storagePath, mediaType);
  const memCached = signedUrlMemoryCache.get(cacheKey);
  const now = Date.now();
  if (memCached && memCached.expiresAt > now) {
    // Skydda mot gamla/ogiltiga cache-värden som pekar på legacy bucket 'profile-media'
    if (typeof memCached.url === 'string' && memCached.url.includes('/profile-media/')) {
      signedUrlMemoryCache.delete(cacheKey);
    } else {
      return memCached.url;
    }
  }

  // 3. Kolla localStorage
  try {
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.expiresAt > now) {
        // Skydda mot gamla/ogiltiga cache-värden som pekar på legacy bucket 'profile-media'
        if (typeof parsed.url === 'string' && parsed.url.includes('/profile-media/')) {
          localStorage.removeItem(cacheKey);
          return null;
        }

        // Uppdatera memory cache
        signedUrlMemoryCache.set(cacheKey, parsed);
        return parsed.url;
      }
    }
  } catch (e) {
    // Ignore cache read errors
  }

  return null;
}

export function useMediaUrl(storagePath: string | null | undefined, mediaType: MediaType, expiresInSeconds: number = 86400) {
  // Hämta cached URL synkront för initial render (INGEN flicker vid tab switch)
  const cachedUrl = useMemo(() => {
    if (!storagePath) return null;
    return getCachedUrlSync(storagePath, mediaType);
  }, [storagePath, mediaType]);
  
  const [url, setUrl] = useState<string | null>(cachedUrl);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!storagePath) {
      setUrl(null);
      return;
    }
    
    // Om vi redan har cached URL, använd den direkt
    if (cachedUrl) {
      setUrl(cachedUrl);
      
      // Ladda blob i bakgrunden för ännu snabbare framtida laddning
      if (!cachedUrl.startsWith('blob:')) {
        imageCache.loadImage(cachedUrl).catch(() => {});
      }
      return;
    }

    const cacheKey = getCacheKey(storagePath, mediaType);
    
    // Undvik dubbla requests för samma resurs globalt
    if (ongoingLoads.has(cacheKey)) return;
    
    // Dubbelkolla cache igen (race condition protection)
    const blobUrl = imageCache.getCachedUrl(storagePath);
    if (blobUrl) {
      setUrl(blobUrl);
      return;
    }
    
    const memCached = signedUrlMemoryCache.get(cacheKey);
    const now = Date.now();
    if (memCached && memCached.expiresAt > now) {
      // Skydda mot legacy cache-värden som pekar på profile-media
      if (typeof memCached.url === 'string' && memCached.url.includes('/profile-media/')) {
        signedUrlMemoryCache.delete(cacheKey);
      } else {
        setUrl(memCached.url);
        imageCache.loadImage(memCached.url).catch(() => {});
        return;
      }
    }

    // Ingen cache finns, generera ny signed URL
    ongoingLoads.add(cacheKey);

    (async () => {
      try {
        const signedUrl = await getMediaUrl(storagePath, mediaType, expiresInSeconds);
        
        if (!signedUrl || !mountedRef.current) {
          ongoingLoads.delete(cacheKey);
          return;
        }

        // Cacha signed URL (expires 80% av faktisk expire tid för säkerhet)
        const expiresAt = now + (expiresInSeconds * 1000 * 0.8);
        const cacheData = { url: signedUrl, expiresAt };
        
        signedUrlMemoryCache.set(cacheKey, cacheData);
        
        try {
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
          // Ignore localStorage errors
        }

        // Visa signed URL direkt
        if (mountedRef.current) {
          setUrl(signedUrl);
        }

        // Ladda blob i bakgrunden för ännu snabbare framtida laddning
        imageCache.loadImage(signedUrl)
          .then(blobUrl => {
            if (mountedRef.current) {
              setUrl(blobUrl);
            }
          })
          .catch(() => {});

      } catch (e) {
        console.error('Failed to get media URL:', e);
      } finally {
        ongoingLoads.delete(cacheKey);
      }
    })();

  }, [storagePath, mediaType, expiresInSeconds, cachedUrl]);

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
