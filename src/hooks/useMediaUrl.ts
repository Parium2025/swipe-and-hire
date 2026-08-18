import { useEffect, useState, useRef, useMemo } from 'react';
import { getMediaUrl, type MediaType, type ImageTransformOptions } from '@/lib/mediaManager';
import { imageCache } from '@/lib/imageCache';

// In-memory cache för signed URLs (överlever re-renders och tab switches)
const signedUrlMemoryCache = new Map<string, { url: string; expiresAt: number }>();

// Track pågående laddningar globalt för att undvika duplicerade requests
const ongoingLoads = new Map<string, Promise<string | null>>();

// Bygg en kort signatur av transform-options för cache-key
const transformSig = (t?: ImageTransformOptions) =>
  t ? `_w${t.width ?? ''}h${t.height ?? ''}q${t.quality ?? ''}r${t.resize ?? ''}` : '';

// LocalStorage cache key (transform ingår så samma bild i olika storlekar inte krockar)
const getCacheKey = (storagePath: string, mediaType: MediaType, transform?: ImageTransformOptions) => 
  `media_url_${mediaType}${transformSig(transform)}_${normalizeStoragePath(storagePath)}`;

function normalizeStoragePath(storagePath: string): string {
  const trimmed = storagePath.trim();
  if (!trimmed.startsWith('http')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/\/storage\/v1\/(?:object|render\/image)\/(?:public|sign)\/[^/]+\/(.+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : trimmed;
  } catch {
    return trimmed;
  }
}

// OBS: 'profile-video' utesluts medvetet. Videofiler är 5–50 MB styck och
// att blob-cacha dem i bulk (25 kandidater + rolling window) skulle förbruka
// hundratals MB och tränga ut profilbilder ur LRU-cachen. Videon streamas
// istället via signed URL direkt i <video>-elementet (samma beteende för
// användaren — ingen UI- eller funktionell skillnad).
const shouldWarmBlobCache = (mediaType: MediaType) =>
  mediaType === 'profile-image' ||
  mediaType === 'cover-image' ||
  mediaType === 'company-logo' ||
  mediaType === 'job-image';

// Tak för minnescachen. Utan tak växer Map:en för varje unik
// (path + typ + transform) som setts under sessionen — på en rekryterare med
// tusentals kandidater blir det tiotusentals poster som aldrig frigörs.
const MAX_MEMORY_CACHE_ENTRIES = 600;

function enforceMemoryCacheLimit() {
  if (signedUrlMemoryCache.size <= MAX_MEMORY_CACHE_ENTRIES) return;
  const overflow = signedUrlMemoryCache.size - MAX_MEMORY_CACHE_ENTRIES;
  let removed = 0;
  // Map bevarar insättningsordning → äldsta poster först (LRU via re-insert).
  for (const key of signedUrlMemoryCache.keys()) {
    signedUrlMemoryCache.delete(key);
    if (++removed >= overflow) break;
  }
}

// Global gräns för samtidiga signed-URL-anrop. Flera warmup-hookar kan annars
// starta 100+ parallella requests vid inloggning, vilket svälter de synliga
// bilderna och triggar rate limits på svaga nät.
const MAX_CONCURRENT_SIGNED_URL_LOADS = 8;
let activeSignedUrlLoads = 0;

// Två köer: synliga komponenter (high) går ALLTID före förladdning (low).
// Utan detta kan 50+ prefetch-anrop äta upp alla slots och en avatar som
// faktiskt syns på skärmen fastnar i "laddar"-läge (tom platta / initialer).
type LoadPriority = 'high' | 'low';
const signedUrlQueueHigh: Array<() => void> = [];
const signedUrlQueueLow: Array<() => void> = [];

function acquireSignedUrlSlot(priority: LoadPriority = 'high'): Promise<void> {
  if (activeSignedUrlLoads < MAX_CONCURRENT_SIGNED_URL_LOADS) {
    activeSignedUrlLoads++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const run = () => {
      activeSignedUrlLoads++;
      resolve();
    };
    (priority === 'high' ? signedUrlQueueHigh : signedUrlQueueLow).push(run);
  });
}

function releaseSignedUrlSlot() {
  activeSignedUrlLoads = Math.max(0, activeSignedUrlLoads - 1);
  const next = signedUrlQueueHigh.shift() ?? signedUrlQueueLow.shift();
  if (next) next();
}

function storeSignedUrlCache(
  cacheKey: string,
  signedUrl: string,
  expiresInSeconds: number,
  now: number
) {
  const expiresAt = now + (expiresInSeconds * 1000 * 0.8);
  const cacheData = { url: signedUrl, expiresAt };

  signedUrlMemoryCache.delete(cacheKey);
  signedUrlMemoryCache.set(cacheKey, cacheData);
  enforceMemoryCacheLimit();

  try {
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch {
    // Ignore localStorage errors
  }
}

// Negativ cache: en path som just misslyckats (rättighetsfel, nätglapp) ska
// inte hamras om och om igen av hundratals kort. Efter kylperioden får den
// försöka igen automatiskt.
const failedLoads = new Map<string, number>();
const FAILED_COOLDOWN_MS = 30_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function getOrCreateSignedUrlLoad(
  storagePath: string,
  mediaType: MediaType,
  expiresInSeconds: number,
  transform?: ImageTransformOptions,
  priority: LoadPriority = 'high'
) {
  const cacheKey = getCacheKey(storagePath, mediaType, transform);
  const existing = ongoingLoads.get(cacheKey);
  if (existing) return existing;

  const failedAt = failedLoads.get(cacheKey);
  if (failedAt && Date.now() - failedAt < FAILED_COOLDOWN_MS) {
    return Promise.resolve<string | null>(null);
  }

  // Upp till 3 försök med kort backoff — täcker tillfälliga nätglapp och
  // token-refresh precis efter inloggning, vilket annars gav en tom avatar.
  const attempts = priority === 'high' ? 3 : 1;

  const promise = acquireSignedUrlSlot(priority)
    .then(async () => {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const now = Date.now();
        let signedUrl: string | null = null;
        try {
          signedUrl = await getMediaUrl(storagePath, mediaType, expiresInSeconds, transform);
        } catch {
          signedUrl = null;
        }
        if (signedUrl) {
          storeSignedUrlCache(cacheKey, signedUrl, expiresInSeconds, now);
          failedLoads.delete(cacheKey);
          return signedUrl;
        }
        if (attempt < attempts - 1) await sleep(250 * (attempt + 1));
      }
      failedLoads.set(cacheKey, Date.now());
      return null;
    })
    .finally(() => {
      releaseSignedUrlSlot();
      ongoingLoads.delete(cacheKey);
    });

  ongoingLoads.set(cacheKey, promise);
  return promise;
}



// Hämta cached URL synkront (för initial render utan flicker)
function getCachedUrlSync(storagePath: string, mediaType: MediaType, transform?: ImageTransformOptions): string | null {
  const cacheKey = getCacheKey(storagePath, mediaType, transform);
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
    if (resolved) {
      // Flytta posten sist i Map:en → äkta LRU vid utrensning.
      signedUrlMemoryCache.delete(cacheKey);
      signedUrlMemoryCache.set(cacheKey, memCached);
      return resolved;
    }
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

export function clearMediaUrlCache(
  storagePath: string | null | undefined,
  mediaType?: MediaType
) {
  if (!storagePath) return;
  const normalizedStoragePath = normalizeStoragePath(storagePath);

  const mediaPrefix = mediaType ? `media_url_${mediaType}` : 'media_url_';
  const matchesStoragePath = (key: string) =>
    key.startsWith(mediaPrefix) && key.endsWith(`_${normalizedStoragePath}`);

  for (const [key, cached] of signedUrlMemoryCache.entries()) {
    if (!matchesStoragePath(key)) continue;
    imageCache.evict(cached.url);
    signedUrlMemoryCache.delete(key);
  }

  // Extra safety: evict blob-cache entries by the actual storage path too.
  // This covers overwritten files where the signed URL may no longer be present
  // in our signed-url caches but the old blob still uses the same object path.
  imageCache.evictByPattern(normalizedStoragePath);

  for (const key of Array.from(ongoingLoads.keys())) {
    if (matchesStoragePath(key)) ongoingLoads.delete(key);
  }

  // Släpp ev. "misslyckad"-markering så nästa render får försöka direkt.
  for (const key of Array.from(failedLoads.keys())) {
    if (matchesStoragePath(key)) failedLoads.delete(key);
  }


  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !matchesStoragePath(key)) continue;

      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (typeof parsed?.url === 'string') imageCache.evict(parsed.url);
        } catch {
          // ignore malformed cache entries
        }
      }
      keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignore storage cleanup failures
  }
}

export function useMediaUrl(
  storagePath: string | null | undefined,
  mediaType: MediaType,
  expiresInSeconds: number = 86400,
  transform?: ImageTransformOptions
) {
  // Stabil signatur för att undvika onödiga re-fetches när transform-objektet ändrar referens
  const transformKey = transformSig(transform);

  // Hämta cached URL synkront för initial render (INGEN flicker vid tab switch)
  const cachedUrl = useMemo(() => {
    if (!storagePath) return null;
    return getCachedUrlSync(storagePath, mediaType, transform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storagePath, mediaType, transformKey]);
  
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
    
    const refreshSignedUrl = async () => {
      clearMediaUrlCache(storagePath, mediaType);
      const freshSignedUrl = await getOrCreateSignedUrlLoad(storagePath, mediaType, expiresInSeconds, transform);
      if (!freshSignedUrl || !mountedRef.current) return;
      setUrl(freshSignedUrl);
      if (shouldWarmBlobCache(mediaType)) {
        imageCache.loadImage(freshSignedUrl)
          .then(blobUrl => {
            if (mountedRef.current) setUrl(blobUrl);
          })
          .catch(() => {});
      }
    };

    // Om vi redan har cached URL, använd den direkt
    if (cachedUrl) {
      setUrl(cachedUrl);
      
      // Ladda blob i bakgrunden för ännu snabbare framtida laddning
      if (shouldWarmBlobCache(mediaType) && !cachedUrl.startsWith('blob:')) {
        imageCache.loadImage(cachedUrl).catch(() => {
          void refreshSignedUrl().catch(() => {});
        });
      }
      return;
    }

    const cacheKey = getCacheKey(storagePath, mediaType, transform);
    
    const memCached = signedUrlMemoryCache.get(cacheKey);
    const now = Date.now();
    if (memCached && memCached.expiresAt > now) {
      // Skydda mot legacy cache-värden som pekar på profile-media
      if (typeof memCached.url === 'string' && memCached.url.includes('/profile-media/')) {
        signedUrlMemoryCache.delete(cacheKey);
      } else {
        setUrl(memCached.url);
        if (shouldWarmBlobCache(mediaType)) {
          imageCache.loadImage(memCached.url).catch(() => {
            void refreshSignedUrl().catch(() => {});
          });
        }
        return;
      }
    }

    (async () => {
      try {
        const signedUrl = await getOrCreateSignedUrlLoad(storagePath, mediaType, expiresInSeconds, transform);
        
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
            .catch(() => {
              void refreshSignedUrl().catch(() => {});
            });
        }

      } catch (e) {
        console.error('Failed to get media URL:', e);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storagePath, mediaType, expiresInSeconds, cachedUrl, transformKey]);

  return url;
}

// Prefetch/prime: seed signed-url cache + blob-cache så avatars kan vara "bam" när man öppnar /candidates
export async function prefetchMediaUrl(
  storagePath: string | null | undefined,
  mediaType: MediaType,
  expiresInSeconds: number = 86400,
  transform?: ImageTransformOptions
): Promise<void> {
  if (!storagePath) return;

  // Om vi redan har en cached signed URL (eller blob) → bara säkerställ blob
  const cached = getCachedUrlSync(storagePath, mediaType, transform);
  if (cached) {
    if (shouldWarmBlobCache(mediaType) && !cached.startsWith('blob:')) {
      await imageCache.loadImage(cached).catch(() => {});
    }
    return;
  }

  try {
    const signedUrl = await getOrCreateSignedUrlLoad(storagePath, mediaType, expiresInSeconds, transform, 'low');

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
