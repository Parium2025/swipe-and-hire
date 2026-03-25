import { useEffect, useState, useRef, useMemo } from 'react';
import { getMediaUrl, type MediaType } from '@/lib/mediaManager';
import { imageCache } from '@/lib/imageCache';

// In-memory cache för signed URLs (överlever re-renders och tab switches)
const signedUrlMemoryCache = new Map<string, { url: string; expiresAt: number }>();

// Track pågående laddningar globalt för att undvika duplicerade requests
const ongoingLoads = new Map<string, Promise<string | null>>();

// LocalStorage cache key
const getCacheKey = (storagePath: string, mediaType: MediaType) => 
  `media_url_${mediaType}_${storagePath}`;

const shouldWarmBlobCache = (mediaType: MediaType) =>
  mediaType === 'profile-image' ||
  mediaType === 'cover-image' ||
  mediaType === 'company-logo' ||
  mediaType === 'job-image' ||
  mediaType === 'profile-video';

function storeSignedUrlCache(
  cacheKey: string,
  signedUrl: string,
  expiresInSeconds: number,
  now: number
) {
  const expiresAt = now + (expiresInSeconds * 1000 * 0.8);
  const cacheData = { url: signedUrl, expiresAt };

  signedUrlMemoryCache.set(cacheKey, cacheData);

  try {
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch {
    // Ignore localStorage errors
  }
}

function getOrCreateSignedUrlLoad(
  storagePath: string,
  mediaType: MediaType,
  expiresInSeconds: number
) {
  const cacheKey = getCacheKey(storagePath, mediaType);
  const existing = ongoingLoads.get(cacheKey);
  if (existing) return existing;

  const now = Date.now();
  const promise = getMediaUrl(storagePath, mediaType, expiresInSeconds)
    .then((signedUrl) => {
      if (signedUrl) {
        storeSignedUrlCache(cacheKey, signedUrl, expiresInSeconds, now);
      }
      return signedUrl;
    })
    .finally(() => {
      ongoingLoads.delete(cacheKey);
    });

  ongoingLoads.set(cacheKey, promise);
  return promise;
}

// Hämta cached URL synkront (för initial render utan flicker)
function getCachedUrlSync(storagePath: string, mediaType: MediaType): string | null {
  const cacheKey = getCacheKey(storagePath, mediaType);
  const now = Date.now();

  const resolveSignedUrl = (signedUrl: string | null | undefined): string | null => {
    if (!signedUrl || typeof signedUrl !== 'string') return null;

    // Skydda mot gamla/ogiltiga cache-värden som pekar på legacy bucket 'profile-media'
    if (signedUrl.includes('/profile-media/')) return null;

    // Om vi redan har blob i cache för den signerade URL:en → instant
    const blobUrl = imageCache.getCachedUrl(signedUrl);
    return blobUrl || signedUrl;
  };

  // 1) Memory cache
  const memCached = signedUrlMemoryCache.get(cacheKey);
  if (memCached && memCached.expiresAt > now) {
    const resolved = resolveSignedUrl(memCached.url);
    if (resolved) return resolved;
    signedUrlMemoryCache.delete(cacheKey);
  }

  // 2) LocalStorage cache
  try {
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);

      if (parsed?.expiresAt > now && typeof parsed.url === 'string') {
        const resolved = resolveSignedUrl(parsed.url);
        if (resolved) {
          // Uppdatera memory cache
          signedUrlMemoryCache.set(cacheKey, parsed);
          return resolved;
        }

        // Legacy/ogiltigt → rensa
        localStorage.removeItem(cacheKey);
      } else if (parsed?.expiresAt <= now) {
        localStorage.removeItem(cacheKey);
      }
    }
  } catch {
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
      if (shouldWarmBlobCache(mediaType) && !cachedUrl.startsWith('blob:')) {
        imageCache.loadImage(cachedUrl).catch(() => {});
      }
      return;
    }

    const cacheKey = getCacheKey(storagePath, mediaType);
    
    const memCached = signedUrlMemoryCache.get(cacheKey);
    const now = Date.now();
    if (memCached && memCached.expiresAt > now) {
      // Skydda mot legacy cache-värden som pekar på profile-media
      if (typeof memCached.url === 'string' && memCached.url.includes('/profile-media/')) {
        signedUrlMemoryCache.delete(cacheKey);
      } else {
        setUrl(memCached.url);
        if (shouldWarmBlobCache(mediaType)) {
          imageCache.loadImage(memCached.url).catch(() => {});
        }
        return;
      }
    }

    (async () => {
      try {
        const signedUrl = await getOrCreateSignedUrlLoad(storagePath, mediaType, expiresInSeconds);
        
        if (!signedUrl || !mountedRef.current) {
          return;
        }

        // Visa signed URL direkt
        if (mountedRef.current) {
          setUrl(signedUrl);
        }

        // Ladda blob i bakgrunden för ännu snabbare framtida laddning
        if (shouldWarmBlobCache(mediaType)) {
          imageCache.loadImage(signedUrl)
            .then(blobUrl => {
              if (mountedRef.current) {
                setUrl(blobUrl);
              }
            })
            .catch(() => {});
        }

      } catch (e) {
        console.error('Failed to get media URL:', e);
      }
    })();

  }, [storagePath, mediaType, expiresInSeconds, cachedUrl]);

  return url;
}

// Prefetch/prime: seed signed-url cache + blob-cache så avatars kan vara "bam" när man öppnar /candidates
export async function prefetchMediaUrl(
  storagePath: string | null | undefined,
  mediaType: MediaType,
  expiresInSeconds: number = 86400
): Promise<void> {
  if (!storagePath) return;

  const cacheKey = getCacheKey(storagePath, mediaType);
  const now = Date.now();

  // Om vi redan har en cached signed URL (eller blob) → bara säkerställ blob
  const cached = getCachedUrlSync(storagePath, mediaType);
  if (cached) {
    if (shouldWarmBlobCache(mediaType) && !cached.startsWith('blob:')) {
      await imageCache.loadImage(cached).catch(() => {});
    }
    return;
  }

  try {
    const signedUrl = await getOrCreateSignedUrlLoad(storagePath, mediaType, expiresInSeconds);
    if (!signedUrl) return;

    // Preloada till blob-cache (så UI kan visa direkt)
    if (shouldWarmBlobCache(mediaType)) {
      await imageCache.loadImage(signedUrl).catch(() => {});
    }
  } finally {
    // no-op: promise cleanup happens inside getOrCreateSignedUrlLoad
  }
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
