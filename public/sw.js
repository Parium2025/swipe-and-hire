const CACHE_VERSION = 'v4';

const IMAGE_CACHE = `parium-images-${CACHE_VERSION}`;
const STATIC_CACHE = `parium-static-${CACHE_VERSION}`;
const API_CACHE = `parium-api-${CACHE_VERSION}`;

// Kritiska assets som alltid ska cachas (offline-fallback)
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
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
          if (cacheName !== IMAGE_CACHE && cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
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

  // Cache-first for images
  if (isImageRequest(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
          // Stale-while-revalidate
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
          }).catch(() => {});
          
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
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

  // Network-first for app shell
  const isAppShell =
    request.mode === 'navigate' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker' ||
    /\.(js|css|html)(\?|$)/.test(new URL(url).pathname);

  if (isAppShell) {
    event.respondWith(
      fetch(new Request(request, { cache: 'reload' })).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const offlineShell = await caches.match('/index.html');
          if (offlineShell) return offlineShell;
        }
        throw new Error('Network error and no cache');
      })
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
            const cachedResponse = await cache.match(url);
            if (!cachedResponse) {
              const response = await fetch(url);
              if (response && response.status === 200) {
                await cache.put(url, response);
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
