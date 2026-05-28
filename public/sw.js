/**
 * ⚠️  PARIUM SERVICE WORKER — MEDVETET INAKTIVERAD (KILL SWITCH)
 * ============================================================
 *
 * Den här filen är INTE en aktiv service worker. Den är en "kill switch"
 * vars enda jobb är att av-registrera sig själv och tömma alla cache-
 * buckets hos användare som tidigare hade en gammal SW installerad.
 *
 * BAKGRUND:
 * Tidigare SW-versioner (v1–v7) cachade landing-bundles aggressivt.
 * När vi släppte nya versioner fastnade Safari på gamla bundles → vit
 * skärm, trasiga bilder, "ghost-versioner" i produktion. Lösningen blev
 * att neutralisera SW:n helt och i stället förlita oss på:
 *   - Supabase Storage + CDN för bilder (browser cache + ETag)
 *   - In-memory blob-cache + IndexedDB i src/lib/imageCache.ts
 *   - Native Image() preload i src/hooks/useGlobalImagePreloader.ts
 *
 * ⛔️  RE-AKTIVERA INTE UTAN ATT LÄSA DETTA FÖRST:
 * Om någon (Mattias, framtida AI, framtida dev) funderar på att skriva
 * en riktig cache-strategi här igen för att t.ex. överleva iOS blob-
 * revoke under minnespress — STANNA. Tidigare incidenter visar att
 * SW-cache i Safari är extremt svår att felsöka och rulla tillbaka.
 * Bygg hellre en fallback i imageCache.ts (memory → IndexedDB →
 * native fetch) än att introducera en aktiv SW igen.
 *
 * Om SW ändå måste återinföras, kräver det:
 *   1. Ny KILL_VERSION-bump + migrationsplan för befintliga kill-clients
 *   2. Strikt scope (endast storage-bilder, ALDRIG HTML/JS-bundles)
 *   3. Versionsstrategi som tål bundle-byten utan stale-content
 *   4. Manuell QA i Safari iOS (privat + normal) + Chrome Android
 *
 * Filer som hör ihop med kill-switchen:
 *   - src/lib/serviceWorkerManager.ts  (no-op helpers)
 *   - src/lib/swForceReset.ts          (engångsrensning i prod)
 *   - public/reset-cache.html          (manuell escape hatch)
 */
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
