/**
 * Session-level shadow for `viewed_at` on job applications.
 *
 * Why: when the user opens a candidate we mark `viewed_at` optimistically and
 * persist to DB, but a later invalidate/refetch can briefly flip the cached
 * value back to `null` (race between optimistic update and refetch). That
 * caused the purple "unread" dot to blink back even though the user just
 * opened the candidate.
 *
 * This shadow lives in `sessionStorage` and answers a single question:
 * "Has the user opened this application in the current session?". If yes,
 * UI never shows the unread indicator again — regardless of cache races.
 */

const STORAGE_KEY = 'viewed-applications-session-v1';

let memoryCache: Set<string> | null = null;

const isBrowser = () => typeof window !== 'undefined';

function load(): Set<string> {
  if (memoryCache) return memoryCache;
  if (!isBrowser()) {
    memoryCache = new Set();
    return memoryCache;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryCache = new Set();
      return memoryCache;
    }
    const parsed = JSON.parse(raw);
    memoryCache = new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    memoryCache = new Set();
  }
  return memoryCache;
}

function persist(set: Set<string>) {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // sessionStorage quota — silent
  }
}

export function markViewedInSession(applicationId: string | null | undefined) {
  if (!applicationId) return;
  const set = load();
  if (set.has(applicationId)) return;
  set.add(applicationId);
  persist(set);
}

export function wasViewedInSession(applicationId: string | null | undefined): boolean {
  if (!applicationId) return false;
  return load().has(applicationId);
}
