const CACHE_NAME = 'parium-v1';
const IMAGE_CACHE = 'parium-images-v1';
const STATIC_CACHE = 'parium-static-v1';

// Kritiska assets som alltid ska cachas
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Mönster för bilder som ska cachas permanent
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
  /\.gif$/
];

// Kolla om URL är en bild
const isImageRequest = (url) => {
  return IMAGE_PATTERNS.some(pattern => pattern.test(url));
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
          if (cacheName !== CACHE_NAME && 
              cacheName !== IMAGE_CACHE && 
              cacheName !== STATIC_CACHE) {
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

  // För alla andra requests: Network-first med cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cacha lyckade HTML/JS/CSS requests
        if (response.status === 200 && 
            (request.url.includes('.js') || 
             request.url.includes('.css') || 
             request.url.includes('.html'))) {
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Om nätverk failar, försök hämta från cache
        return caches.match(request);
      })
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
      caches.delete(IMAGE_CACHE).then(() => {
        console.log('[SW] Image cache cleared');
        return caches.open(IMAGE_CACHE);
      })
    );
  }
});

console.log('[SW] Service Worker loaded');
