/**
 * IndexedDB-persistens för imageCache.
 *
 * Strategi:
 *  • Lagrar ENDAST små assets (logos/ikoner ≤ PERSIST_MAX_BYTES) → undviker
 *    att fylla user-disk med 200–800 KB jobb-bilder.
 *  • Vid app-start hydreras alla giltiga poster till in-memory cachen
 *    (synkron `getCachedUrl` returnerar då blob-URL utan nätverk).
 *  • Skrivningar är fire-and-forget — påverkar aldrig render-tiden.
 *  • Om IDB inte är tillgängligt (privat läge, gammal browser, kvot full) →
 *    appen fungerar exakt som tidigare, bara utan persistens.
 */

const DB_NAME = 'parium-image-cache';
const DB_VERSION = 1;
const STORE = 'blobs';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagar
export const PERSIST_MAX_BYTES = 50 * 1024; // 50 KB — matchar SMALL_ASSET_THRESHOLD i imageCache

export interface PersistedBlob {
  cacheKey: string;
  blob: Blob;
  url: string;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
let supported: boolean | null = null;

function isSupported(): boolean {
  if (supported !== null) return supported;
  supported = typeof window !== 'undefined' && 'indexedDB' in window;
  return supported;
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isSupported()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'cacheKey' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[imageCache] IDB open failed', req.error);
        resolve(null);
      };
      req.onblocked = () => resolve(null);
    } catch (err) {
      console.warn('[imageCache] IDB unavailable', err);
      resolve(null);
    }
  });
  return dbPromise;
}

/**
 * Hämta alla giltiga poster från IDB. Utgångna rensas i bakgrunden.
 */
export async function loadAllPersisted(): Promise<PersistedBlob[]> {
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const all: PersistedBlob[] = req.result || [];
        const now = Date.now();
        const valid: PersistedBlob[] = [];
        const expired: string[] = [];
        for (const item of all) {
          if (now - item.timestamp < TTL_MS) valid.push(item);
          else expired.push(item.cacheKey);
        }
        if (expired.length > 0) {
          // Rensa utgångna i bakgrunden
          deleteKeys(expired).catch(() => {});
        }
        resolve(valid);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Spara en blob till IDB. Fire-and-forget — fel sväljs.
 */
export async function persistBlob(
  cacheKey: string,
  blob: Blob,
  url: string,
): Promise<void> {
  if (blob.size > PERSIST_MAX_BYTES) return; // Endast små assets
  const db = await openDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put({ cacheKey, blob, url, timestamp: Date.now() } as PersistedBlob);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteKeys(keys: string[]): Promise<void> {
  const db = await openDb();
  if (!db || keys.length === 0) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const k of keys) store.delete(k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearAllPersisted(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getPersistedStats(): Promise<{ count: number; bytes: number }> {
  const all = await loadAllPersisted();
  return {
    count: all.length,
    bytes: all.reduce((s, i) => s + (i.blob?.size || 0), 0),
  };
}
