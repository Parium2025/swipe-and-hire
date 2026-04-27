const KILL_VERSION = 'sw-kill-2026-04-27-v10-clear-all-and-navigate';

const clearPariumCaches = async () => {
  try {
    if (typeof caches === 'undefined' || !caches.keys) return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
  } catch {
    // ignore
  }
};

const notifyClients = async () => {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => {
      try {
        client.postMessage({ type: 'PARIUM_SW_REMOVED', version: KILL_VERSION });
      } catch {
        // ignore
      }

      try {
        const url = new URL(client.url);
        url.searchParams.set('_sw_killed', `${KILL_VERSION}-${Date.now()}`);
        client.navigate(url.toString()).catch(() => undefined);
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await clearPariumCaches();
      await self.clients.claim();
      try {
        await self.registration.unregister();
      } catch {
        // ignore
      }
      await notifyClients();
    })()
  );
});

self.addEventListener('fetch', () => {
  // Intentionally do not call respondWith: all requests go straight to network/browser.
});

self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data.type === 'CLEAR_IMAGE_CACHE')) {
    event.waitUntil(clearPariumCaches());
  }
});

console.log('[SW] Parium service worker disabled', KILL_VERSION);
