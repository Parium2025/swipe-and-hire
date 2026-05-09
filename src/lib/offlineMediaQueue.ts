/**
 * 🗄️ OFFLINE MEDIA QUEUE — IndexedDB-baserad kö för media-uploads.
 *
 * Varför IndexedDB?
 *   localStorage klarar inte binärdata och har 5MB-tak. En enda 50 MB-video
 *   skulle blockera allt annat. IndexedDB hanterar Blobs nativt och har
 *   GB-nivå-quota i moderna browsers.
 *
 * Lifecycle:
 *   1. Upload failar (ej online ELLER alla retries uttömda) → enqueueMediaUpload()
 *   2. Blob + metadata sparas i IDB
 *   3. När enheten är online igen → flushMediaQueue() försöker igen
 *   4. Vid framgång → callback uppdaterar DB med storage path → kö rensas
 *   5. Vid permanent fel (>10 försök) → toast varnar + kö rensas
 *
 * Säkerhet:
 *   - Endast aktuell user ID:s queued items hanteras
 *   - Inget läcker mellan inloggningar
 */

import type { MediaType } from '@/lib/mediaManager';

const DB_NAME = 'parium-media-queue';
const DB_VERSION = 1;
const STORE = 'queue';
const MAX_ATTEMPTS = 10;

export interface QueuedMediaUpload {
  id: string;
  userId: string;
  mediaType: MediaType;
  blob: Blob;
  fileName: string;
  /** Vilket fält i databasen som ska uppdateras (t.ex. 'profile_image_url') */
  targetField: string;
  /** Vilken tabell som ska uppdateras (t.ex. 'profiles') */
  targetTable: string;
  /** ID på raden som ska uppdateras */
  targetId: string;
  /** Kolumn att matcha targetId mot (default 'user_id' för profiles, 'id' för andra) */
  targetIdColumn: string;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('queuedAt', 'queuedAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[mediaQueue] IDB open failed', req.error);
        resolve(null);
      };
      req.onblocked = () => resolve(null);
    } catch (err) {
      console.warn('[mediaQueue] IDB unavailable', err);
      resolve(null);
    }
  });
  return dbPromise;
}

export async function enqueueMediaUpload(
  upload: Omit<QueuedMediaUpload, 'id' | 'queuedAt' | 'attempts'>,
): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;

  const id = `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const item: QueuedMediaUpload = {
    ...upload,
    id,
    queuedAt: Date.now(),
    attempts: 0,
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getQueuedUploads(userId: string): Promise<QueuedMediaUpload[]> {
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const idx = store.index('userId');
      const req = idx.getAll(userId);
      req.onsuccess = () => resolve((req.result || []) as QueuedMediaUpload[]);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function removeQueuedUpload(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function updateQueuedUpload(
  id: string,
  patch: Partial<Pick<QueuedMediaUpload, 'attempts' | 'lastError'>>,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        const item = req.result as QueuedMediaUpload | undefined;
        if (!item) return resolve();
        const updated = { ...item, ...patch };
        store.put(updated);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export const MEDIA_QUEUE_MAX_ATTEMPTS = MAX_ATTEMPTS;
