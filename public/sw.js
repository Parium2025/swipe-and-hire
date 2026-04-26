const CACHE_VERSION = 'v11';

const IMAGE_CACHE = `parium-images-${CACHE_VERSION}`;
const STATIC_CACHE = `parium-static-${CACHE_VERSION}`;
const API_CACHE = `parium-api-${CACHE_VERSION}`;

/**
 * Normalisera bild-URL för cache-nyckel:
 * - Strippar rotating signed-URL tokens (token, X-Amz-*, etc.) så att samma fil
 *   inte cachas flera gånger när Supabase signerar om URL:en.
 * - Behåller versions-parametrar (v, version, t) som vi använder för cache-busting.
 */
const normalizeImageRequest = (request) => {
  try {
    const url = new URL(request.url);
    const isStorageObject = url.pathname.includes('/storage/v1/object/');
    if (!isStorageObject) return request;

    const version = url.searchParams.get('v') || url.searchParams.get('version') || url.searchParams.get('t');
    // Bygg ren URL utan query, lägg sedan tillbaka endast versions-param om den finns
    const cleanUrl = `${url.origin}${url.pathname}${version ? `?v=${version}` : ''}`;
    return new Request(cleanUrl, { method: 'GET', mode: request.mode, credentials: request.credentials });
  } catch {
    return request;
  }
};

// Kritiska assets som alltid ska cachas (offline-fallback).
// VIKTIGT: Vi cachar INTE '/' eller '/index.html' här — HTML/JS/CSS hämtas
// alltid färskt från nätet (se fetch handler nedan). Detta ser till att
// nya deploys syns omedelbart utan hard refresh.
const CRITICAL_ASSETS = [
  '/favicon-parium.png',
];

// Mönster för bilder och filer som ska cachas permanent
const IMAGE_PATTERNS = [
  /\/storage\/v1\/object\/public\//,
  /\/storage\/v1\/object\/sign\//,
  /job-images/,
  /job-applications/,
  /profile-media/,
  /company-logos/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.png$/,
  /\.webp$/,
  /\.gif$/,
  /\.mp4$/,
  /\.webm$/,
  /\.mov$/,
  /\.pdf$/,
  /\.doc$/,
  /\.docx$/,
];

// API-anrop som ska cachas för offline support
// Viktigt: cacha INTE job_postings eller profiles eftersom de måste vara färska
// för att företagsnamn/logga ska uppdateras direkt i jobbsökarvyer.
const API_PATTERNS = [
  /\/rest\/v1\/job_applications/,
  /\/rest\/v1\/organizations/,
  /\/rest\/v1\/job_questions/,
];

// Offline queue keys to check in localStorage (read via IndexedDB or message)
const OFFLINE_QUEUE_KEYS = [
  'parium_offline_message_queue',
  'parium_offline_application_queue',
  'parium_offline_saved_jobs_queue',
  'parium_offline_profile_queue',
  'parium_candidate_ops_queue',
];

const isImageRequest = (url) => {
  return IMAGE_PATTERNS.some(pattern => pattern.test(url));
};

const isLandingFrameRequest = (url) => {
  try {
    return new URL(url).pathname.startsWith('/landing-frames/');
  } catch {
    return false;
  }
};

const isApiRequest = (url) => {
  return API_PATTERNS.some(pattern => pattern.test(url));
};

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    console.log('[SW] Caching critical assets');

    await Promise.allSettled(
      CRITICAL_ASSETS.map(async (asset) => {
        try {
          await cache.add(asset);
        } catch (error) {
          console.warn('[SW] Failed to cache critical asset:', asset, error);
        }
      })
    );

    await self.skipWaiting();
  })());
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('parium-') && cacheName !== IMAGE_CACHE && cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            console.log('[SW] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// ─── BACKGROUND SYNC ────────────────────────────────────────────────
// When the browser regains connectivity, this fires even if the app tab
// is closed. We notify all open clients to flush their offline queues.

self.addEventListener('sync', (event) => {
  if (event.tag === 'parium-offline-sync') {
    console.log('[SW] Background sync triggered');
    
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        if (clients.length > 0) {
          // Notify all open tabs to run their sync logic
          clients.forEach((client) => {
            client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
          });
          console.log(`[SW] Notified ${clients.length} client(s) to sync`);
        } else {
          console.log('[SW] No open clients — sync will happen when app opens');
        }
        
        // Notify completion
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_COMPLETE' });
        });
      })
    );
  }
});

// ─── PERIODIC BACKGROUND SYNC (if available) ────────────────────────
// Keeps data fresh even when the app isn't actively used

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'parium-periodic-sync') {
    console.log('[SW] Periodic sync triggered');
    
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_PERIODIC_SYNC' });
        });
      })
    );
  }
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  if (request.method !== 'GET') {
    return;
  }

  // Landingens frame-by-frame hero måste alltid hämtas färskt från deployen.
  // De här filerna versioneras i React-koden och får inte fastna i SW image-cache.
  if (isLandingFrameRequest(url)) {
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })));
    return;
  }

  // Cache-first for images (med normaliserad cache-nyckel för att undvika dubletter)
  if (isImageRequest(url)) {
    const cacheKey = normalizeImageRequest(request);
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(cacheKey);
        
        if (cachedResponse) {
          // Stale-while-revalidate (använd original request för faktisk fetch)
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(cacheKey, networkResponse.clone());
            }
          }).catch(() => {});
          
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          
          if (networkResponse && networkResponse.status === 200) {
            cache.put(cacheKey, networkResponse.clone());
          }
          
          return networkResponse;
        } catch (error) {
          throw error;
        }
      })
    );
    return;
  }

  // Känsliga live-data endpoints ska aldrig serveras från API-cache
  if (/\/rest\/v1\/(job_postings|profiles)/.test(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first for API calls with cache fallback
  if (isApiRequest(url)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          
          if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            cache.put(request, networkResponse.clone());
          }
          
          return networkResponse;
        } catch (error) {
          const cachedResponse = await cache.match(request);
          
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return new Response(JSON.stringify({ 
            error: 'Offline - ingen cachad data tillgänglig',
            offline: true 
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // Network-first for app shell — ALWAYS bypass HTTP cache for navigations & HTML
  // so mobile users get the latest version without a hard refresh.
  const urlPath = new URL(url).pathname;
  const isNavigation = request.mode === 'navigate';
  const isHtml = /\.html?(\?|$)/.test(urlPath) || urlPath === '/';
  const isAppShell =
    isNavigation ||
    isHtml ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker' ||
    /\.(js|css)(\?|$)/.test(urlPath);

  if (isAppShell) {
    event.respondWith(
      (async () => {
        try {
          // Force a fresh fetch — bypass both browser HTTP cache and any SW cache.
          const fresh = await fetch(new Request(request, { cache: 'no-store' }));
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (isNavigation) {
            const offlineShell = await caches.match('/index.html');
            if (offlineShell) return offlineShell;
          }
          throw new Error('Network error and no cache');
        }
      })()
    );
    return;
  }

  // Default: Network-first with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Message event
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Track pending offline ops (from the app)
  if (event.data && event.data.type === 'PENDING_OFFLINE_OPS') {
    console.log('[SW] App has pending offline ops, will sync when online');
    // Register a sync event to handle when connectivity returns
    if (self.registration && 'sync' in self.registration) {
      self.registration.sync.register('parium-offline-sync').catch(() => {
        console.log('[SW] Could not register sync — will rely on app-level sync');
      });
    }
  }
  
  // Preload images
  if (event.data && event.data.type === 'PRELOAD_IMAGES') {
    const urls = event.data.urls || [];
    
    event.waitUntil(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        for (const url of urls) {
          try {
            const request = new Request(url, { method: 'GET' });
            const cacheKey = normalizeImageRequest(request);
            const cachedResponse = await cache.match(cacheKey);
            if (!cachedResponse) {
              const response = await fetch(request);
              if (response && response.status === 200) {
                await cache.put(cacheKey, response.clone());
              }
            }
          } catch (error) {
            console.warn('[SW] Failed to preload:', url, error);
          }
        }
      })
    );
  }

  // Clear caches
  if (event.data && event.data.type === 'CLEAR_IMAGE_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(IMAGE_CACHE),
        caches.delete(API_CACHE)
      ]).then(() => {
        return Promise.all([
          caches.open(IMAGE_CACHE),
          caches.open(API_CACHE)
        ]);
      })
    );
  }
});

console.log('[SW] Service Worker loaded (with background sync support)');
