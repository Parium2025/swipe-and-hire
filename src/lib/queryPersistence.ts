import { dehydrate, hydrate, type QueryClient, type Query } from '@tanstack/react-query';

/**
 * Kontobunden ögonblicksbild av React Query-cachen.
 *
 * Vid kallstart (omladdning, iOS som stängt fliken, återkomst efter en stund)
 * återställs senast visade data synkront innan sidorna renderas — inga
 * skeletons. Varje återställd fråga hämtas sedan om tyst första gången en vy
 * använder den, så innehållet alltid blir färskt utan synligt vänteläge.
 */

const PREFIX = 'parium-rq-snapshot:v2:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TOTAL_CHARS = 1_500_000;
const MAX_QUERY_CHARS = 250_000;

const restoredHashes = new Set<string>();
let restoredUserId: string | null = null;
let activeUserId: string | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

/** Endast ren JSON-data: Set/Map/Date/klassinstanser överlever inte en omstart. */
function isPlainJson(v: unknown, depth = 0): boolean {
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return true;
  if (typeof v !== 'object' || depth > 12) return false;
  if (Array.isArray(v)) return v.every((x) => isPlainJson(x, depth + 1));
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(v as Record<string, unknown>).every((x) => x === undefined || isPlainJson(x, depth + 1));
}

function persistable(query: Query): boolean {
  if (query.state.status !== 'success' || query.state.data === undefined) return false;
  const first = query.queryKey[0];
  // Auth-/sessionsnära nycklar sparas aldrig.
  if (typeof first === 'string' && /session|auth|token|signed-url/i.test(first)) return false;
  return isPlainJson(query.state.data);
}

function writeSnapshot(qc: QueryClient) {
  const userId = activeUserId;
  if (!userId || typeof window === 'undefined') return;
  try {
    const state = dehydrate(qc, { shouldDehydrateQuery: persistable });
    let total = 0;
    const queries = [];
    // Senast uppdaterade först så det viktigaste får plats.
    const sorted = [...state.queries].sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
    for (const q of sorted) {
      let size: number;
      try { size = JSON.stringify(q.state.data).length; } catch { continue; }
      if (size > MAX_QUERY_CHARS || total + size > MAX_TOTAL_CHARS) continue;
      total += size;
      queries.push(q);
    }
    const payload = JSON.stringify({ t: Date.now(), state: { mutations: [], queries } });
    try {
      localStorage.setItem(PREFIX + userId, payload);
    } catch {
      // Fullt lagringsutrymme: hellre ingen ögonblicksbild än en trasig.
      try { localStorage.removeItem(PREFIX + userId); } catch { /* noop */ }
    }
  } catch { /* aldrig störa appen */ }
}

function schedulePersist(qc: QueryClient) {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const run = () => writeSnapshot(qc);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 2000 });
    } else run();
  }, 1500);
}

/** Startas en gång: sparar löpande och uppdaterar återställd data tyst. */
export function startQueryPersistence(qc: QueryClient) {
  if (started || typeof window === 'undefined') return;
  started = true;
  qc.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success') schedulePersist(qc);
    if (event.type === 'observerAdded' && restoredHashes.has(event.query.queryHash)) {
      restoredHashes.delete(event.query.queryHash);
      const q = event.query;
      // Tyst bakgrundshämtning — återställd data syns under tiden.
      setTimeout(() => { void q.fetch().catch(() => { /* behåll senast kända */ }); }, 0);
    }
  });
  const flush = () => { if (document.visibilityState === 'hidden') writeSnapshot(qc); };
  document.addEventListener('visibilitychange', flush);
  window.addEventListener('pagehide', () => writeSnapshot(qc));
}

/** Synkron återställning för rätt konto. Anropas innan användaren sätts i state. */
export function restoreQuerySnapshot(qc: QueryClient, userId: string | null | undefined, force = false) {
  activeUserId = userId ?? null;
  if (force) restoredUserId = null;
  if (!userId || restoredUserId === userId || typeof window === 'undefined') return;
  restoredUserId = userId;
  try {
    const raw = localStorage.getItem(PREFIX + userId);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.state || Date.now() - (parsed.t ?? 0) > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + userId);
      return;
    }
    const cache = qc.getQueryCache();
    // Fyll bara luckor — färskare data i minnet vinner alltid.
    const queries = (parsed.state.queries ?? []).filter((q: any) => !cache.get(q.queryHash)?.state.data);
    hydrate(qc, { mutations: [], queries });
    if (queries.length === 0) restoredUserId = null;
    for (const q of queries) restoredHashes.add(q.queryHash);
  } catch {
    try { localStorage.removeItem(PREFIX + userId); } catch { /* noop */ }
  }
}

/** Sant när senast visade data återställts vid kallstart — sidor kan då hoppa över fördröjd fade-in. */
export function hasRestoredSnapshot(): boolean {
  return restoredUserId !== null && restoredUserId === activeUserId;
}

/** Utloggning/kontobyte: inget får följa med till nästa konto. */
export function clearQuerySnapshots() {
  restoredHashes.clear();
  restoredUserId = null;
  activeUserId = null;
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  if (typeof window === 'undefined') return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* noop */ }
}
