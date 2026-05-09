/**
 * 📋 OFFLINE JOB QUEUE — IndexedDB-baserad kö för annons-uppdateringar.
 *
 * Skyddar arbetsgivaren mot data-förlust när nätet pajar mitt i:
 *   - Publicering av ny annons
 *   - Redigering av befintlig annons
 *
 * Lifecycle:
 *   1. publish/update failar → queueJobOperation()
 *   2. Hela payloaden sparas i IDB (inkl. status: pending/syncing/failed)
 *   3. Online → flush replayar via supabase.from('job_postings').insert/update
 *   4. Vid framgång → kö rensas + cache invalideras
 *
 * Säkerhet:
 *   - Endast aktuell user ID:s queued items hanteras
 *   - Validering före replay (employer_id måste matcha auth.uid)
 */

import type { Database } from '@/integrations/supabase/types';

const DB_NAME = 'parium-job-queue';
const DB_VERSION = 1;
const STORE = 'queue';
const MAX_ATTEMPTS = 8;

export type JobOperationType = 'insert' | 'update';

type JobInsert = Database['public']['Tables']['job_postings']['Insert'];
type JobUpdate = Database['public']['Tables']['job_postings']['Update'];

export interface QueuedJobOperation {
  id: string;
  userId: string;
  operation: JobOperationType;
  /** För update: id på job_postings-raden */
  jobId?: string;
  payload: JobInsert | JobUpdate;
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
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function enqueueJobOperation(
  op: Omit<QueuedJobOperation, 'id' | 'queuedAt' | 'attempts'>,
): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;

  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const item: QueuedJobOperation = { ...op, id, queuedAt: Date.now(), attempts: 0 };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function getQueuedJobs(userId: string): Promise<QueuedJobOperation[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const idx = tx.objectStore(STORE).index('userId');
      const req = idx.getAll(userId);
      req.onsuccess = () => resolve((req.result || []) as QueuedJobOperation[]);
      req.onerror = () => resolve([]);
    } catch { resolve([]); }
  });
}

export async function removeQueuedJob(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

export async function updateQueuedJob(
  id: string,
  patch: Partial<Pick<QueuedJobOperation, 'attempts' | 'lastError'>>,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        const item = req.result as QueuedJobOperation | undefined;
        if (!item) return resolve();
        store.put({ ...item, ...patch });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

export const JOB_QUEUE_MAX_ATTEMPTS = MAX_ATTEMPTS;
