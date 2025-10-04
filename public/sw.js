/* Simple cache-busting Service Worker for iOS A2HS
   - Always fetch fresh for HTML/CSS/JS
   - Clear all old caches on activate
   - Claim clients immediately so new SW controls pages
*/
const VERSION = '20251006-01';

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Network-first for critical app assets
  const critical = req.mode === 'navigate' || ['document','script','style'].includes(req.destination);
  if (critical) {
    event.respondWith(
      fetch(new Request(req, { cache: 'reload' }))
        .then((res) => res)
        .catch(() => caches.match(req))
    );
    return;
  }
  // Default: bypass caches
  event.respondWith(fetch(req));
});
