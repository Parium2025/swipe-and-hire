// Service Worker för aggressiv bild-cachning
const CACHE_NAME = 'parium-images-v1';
const IMAGE_CACHE_TIME = 30 * 24 * 60 * 60 * 1000; // 30 dagar

// URL-patterns som ska cachas aggressivt
const IMAGE_PATTERNS = [
  /\/storage\/v1\/object\/.*\.(jpg|jpeg|png|gif|webp|svg)/i,
  /job-images/i,
  /job-applications/i,
  /profile-media/i,
  /company-logos/i,
];

// Kolla om en URL är en bild
const isImageRequest = (url) => {
  return IMAGE_PATTERNS.some(pattern => pattern.test(url));
};

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - Aggressiv cachning för bilder
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Endast för bilder
  if (!isImageRequest(url)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Försök hämta från cache först
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        console.log('[SW] Serving from cache:', url);
        
        // Kontrollera ålder på cachad bild
        const dateHeader = cachedResponse.headers.get('date');
        const cachedTime = dateHeader ? new Date(dateHeader).getTime() : 0;
        const now = Date.now();
        
        // Om bilden är yngre än 30 dagar, använd den
        if (now - cachedTime < IMAGE_CACHE_TIME) {
          return cachedResponse;
        }
        
        console.log('[SW] Cache expired, fetching fresh image');
      }

      // Annars hämta från nätet
      try {
        const networkResponse = await fetch(request);
        
        // Cacha bara lyckade svar
        if (networkResponse && networkResponse.status === 200) {
          console.log('[SW] Caching new image:', url);
          cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        console.log('[SW] Network failed, returning cached response if available');
        
        // Om nätet misslyckas, returnera cachad version även om den är gammal
        if (cachedResponse) {
          return cachedResponse;
        }
        
        throw error;
      }
    })
  );
});

// Message event för att rensa cache manuellt
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] Cache cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});
