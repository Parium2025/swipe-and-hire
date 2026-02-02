const CACHE_VERSION = 'v3';

const IMAGE_CACHE = `parium-images-${CACHE_VERSION}`;
const STATIC_CACHE = `parium-static-${CACHE_VERSION}`;
const API_CACHE = `parium-api-${CACHE_VERSION}`;

// Kritiska assets som alltid ska cachas (offline-fallback)
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
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
const API_PATTERNS = [
  /\/rest\/v1\/job_postings/,
  /\/rest\/v1\/profiles/,
  /\/rest\/v1\/job_applications/,
  /\/rest\/v1\/organizations/,
  /\/rest\/v1\/job_questions/,
];

// Kolla om URL är en bild
const isImageRequest = (url) => {
  return IMAGE_PATTERNS.some(pattern => pattern.test(url));
};

// Kolla om URL är ett API-anrop
const isApiRequest = (url) => {
  return API_PATTERNS.some(pattern => pattern.test(url));
};

// Install event - förbered cachen
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching critical assets');
      return cache.addAll(CRITICAL_ASSETS);
    }).then(() => {
      // Aktivera ny worker direkt
      return self.skipWaiting();
    })
  );
});

// Activate event - rensa gamla cachar
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
      // Ta över alla klienter direkt
      return self.clients.claim();
    })
  );
});

// Fetch event - Cache-first för bilder, Network-first för allt annat
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Ignorera non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Hantera bilder med Cache-first strategin (permanent cache)
  if (isImageRequest(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        // Försök hämta från cache först
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
          console.log('[SW] Serving image from cache:', url.substring(0, 80) + '...');
          
          // Returnera cached version direkt
          // Uppdatera i bakgrunden (stale-while-revalidate)
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
          }).catch(() => {
            // Ignorera network errors i bakgrunden
          });
          
          return cachedResponse;
        }

        // Om inte i cache, hämta från nätverk
        try {
          console.log('[SW] Fetching image from network:', url.substring(0, 80) + '...');
          const networkResponse = await fetch(request);
          
          // Cacha om det är en lyckad response
          if (networkResponse && networkResponse.status === 200) {
            // Klona response innan vi cachar (kan bara läsas en gång)
            cache.put(request, networkResponse.clone());
            console.log('[SW] Cached new image:', url.substring(0, 80) + '...');
          }
          
          return networkResponse;
        } catch (error) {
          console.error('[SW] Failed to fetch image:', error);
          // Returnera en fallback om möjligt
          throw error;
        }
      })
    );
    return;
  }

  // Hantera API-anrop med Cache-first strategin för offline support
  if (isApiRequest(url)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        // Försök hämta från nätverk först
        try {
          const networkResponse = await fetch(request);
          
          // Cacha lyckade GET requests
          if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            cache.put(request, networkResponse.clone());
            console.log('[SW] Cached API response:', url.substring(0, 80) + '...');
          }
          
          return networkResponse;
        } catch (error) {
          // Om offline, försök hämta från cache
          console.log('[SW] Network failed, trying cache for:', url.substring(0, 80) + '...');
          const cachedResponse = await cache.match(request);
          
          if (cachedResponse) {
            console.log('[SW] Serving API response from cache (offline mode)');
            return cachedResponse;
          }
          
          // Om ingen cache finns, returnera error response
          console.error('[SW] No cache available for offline request');
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

  // För app-shell (HTML/JS/CSS): alltid hämta färskt från nätverk för att undvika "fast" UI efter uppdateringar
  const isAppShell =
    request.mode === 'navigate' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker' ||
    /\.(js|css|html)(\?|$)/.test(new URL(url).pathname);

  if (isAppShell) {
    event.respondWith(
      fetch(new Request(request, { cache: 'reload' })).catch(async () => {
        // Offline fallback
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

  // För alla andra requests: Network-first med cache fallback (för t.ex. fonts)
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Message event - hantera meddelanden från appen
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Preload bilder på begäran
  if (event.data && event.data.type === 'PRELOAD_IMAGES') {
    const urls = event.data.urls || [];
    console.log(`[SW] Preloading ${urls.length} images...`);
    
    event.waitUntil(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        for (const url of urls) {
          try {
            const cachedResponse = await cache.match(url);
            if (!cachedResponse) {
              const response = await fetch(url);
              if (response && response.status === 200) {
                await cache.put(url, response);
                console.log('[SW] Preloaded:', url.substring(0, 80) + '...');
              }
            }
          } catch (error) {
            console.warn('[SW] Failed to preload:', url, error);
          }
        }
        console.log('[SW] Preload complete!');
      })
    );
  }

  // Rensa image cache på begäran
  if (event.data && event.data.type === 'CLEAR_IMAGE_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(IMAGE_CACHE),
        caches.delete(API_CACHE)
      ]).then(() => {
        console.log('[SW] Image and API cache cleared');
        return Promise.all([
          caches.open(IMAGE_CACHE),
          caches.open(API_CACHE)
        ]);
      })
    );
  }
});

console.log('[SW] Service Worker loaded');
