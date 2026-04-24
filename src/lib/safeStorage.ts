/**
 * Safe localStorage wrapper with automatic eviction on QuotaExceededError.
 * Prevents silent crashes when the ~5MB browser limit is hit.
 */

const EVICTION_KEYS_PREFIX = [
  'candidate-profile-',
  'applications_snapshot_',
  'ratings_cache_',
  'stage_settings_cache_',
  'eager_preload_',
  'conversations_cache_',
  'team_members_cache_',
  'interviews_cache_',
  'job-details-cache-',
  'saved-jobs-cache',
  'parium-employer-analytics:',
  'outreach-studio-cache:',
  'outreach-templates-cache:',
  'parium_employer_jobs_v3_',
  'parium_employer_counts_v1_',
  'parium_employer_stats_v1_',
];

/**
 * Attempts to evict oldest cache entries to free space.
 * Only targets known app cache keys, never auth or critical state.
 */
function evictOldestEntries(requiredKey: string): boolean {
  try {
    const candidates: { key: string; timestamp: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key === requiredKey) continue;

      // Only evict known cache keys
      const isEvictable = EVICTION_KEYS_PREFIX.some(prefix => key.startsWith(prefix));
      if (!isEvictable) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        // Extract timestamp from various cache formats
        const ts = parsed?.timestamp || parsed?.cachedAt || 0;
        candidates.push({ key, timestamp: typeof ts === 'number' ? ts : 0 });
      } catch {
        // Can't parse = old junk, evict it
        candidates.push({ key, timestamp: 0 });
      }
    }

    if (candidates.length === 0) return false;

    // Sort oldest first, evict up to 20% of candidates
    candidates.sort((a, b) => a.timestamp - b.timestamp);
    const evictCount = Math.max(1, Math.ceil(candidates.length * 0.2));

    for (let i = 0; i < evictCount; i++) {
      localStorage.removeItem(candidates[i].key);
    }

    console.log(`[safeStorage] Evicted ${evictCount} old cache entries to free space`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe setItem that auto-evicts old cache entries on QuotaExceededError.
 * Returns true if the write succeeded, false otherwise.
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    // QuotaExceededError — try eviction and retry once
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      const freed = evictOldestEntries(key);
      if (freed) {
        try {
          localStorage.setItem(key, value);
          return true;
        } catch {
          // Still full after eviction — give up silently
        }
      }
    }
    return false;
  }
}

/**
 * Säkert läsa en JSON-cache från localStorage.
 *
 * Returnerar `null` (och RENSAR posten) om något är fel:
 *   - nyckeln saknas
 *   - innehållet är ogiltig JSON
 *   - parseat värde är inte ett objekt (null/primitiv)
 *   - en valfri `validate(parsed)` returnerar false
 *
 * Detta är försvaret som gör att korrupta eller gamla cacheformat
 * ALDRIG kan krascha appen via `.map`/`.filter`/`.length`.
 */
export function safeReadJsonCache<T>(
  key: string,
  validate?: (parsed: unknown) => parsed is T,
): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return null;
    }
    if (validate && !validate(parsed)) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return null;
    }
    return parsed as T;
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Specialiserad helper för det vanligaste mönstret:
 * en cache-envelope med ett array-fält. Validerar att fältet är en array.
 *
 * Användning:
 *   const items = safeReadArrayCache<MyItem>(key, 'items');
 *   // items är garanterat antingen en MyItem[] eller null
 */
export function safeReadArrayCache<T>(
  key: string,
  arrayField: string = 'items',
  extraValidate?: (envelope: Record<string, unknown>) => boolean,
): T[] | null {
  const env = safeReadJsonCache<Record<string, unknown>>(key);
  if (!env) return null;
  const arr = env[arrayField];
  if (!Array.isArray(arr)) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
  if (extraValidate && !extraValidate(env)) {
    return null;
  }
  return arr as T[];
}

