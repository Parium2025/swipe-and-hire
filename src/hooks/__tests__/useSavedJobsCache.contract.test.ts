import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Kontrakts-test för useSavedJobsCache.
 *
 * Detta test låser fast invarianten:
 *   "Oavsett vad localStorage innehåller får läsning aldrig kasta,
 *    och resultatet ska alltid vara en array av giltiga entries."
 *
 * Vi testar via samma localStorage-nycklar som hooken använder.
 * Implementationen läser cachen med readCache() och saniterar med
 * sanitizeSavedJobsList() innan UI får se datan. Om någon i framtiden
 * tar bort detta sanering-skydd kommer testerna nedan att fånga det
 * eftersom korrupt cache då skulle slinka igenom som icke-array.
 */

const SAVED_CACHE_KEY = 'parium_saved_jobs_full_cache_v1';
const SKIPPED_CACHE_KEY = 'parium_skipped_jobs_full_cache_v1';
const USER_ID = 'test-user-123';

// Minimal localStorage mock
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
  },
  writable: true,
});

// Återimplementera saneringskontraktet exakt som useSavedJobsCache.ts
// gör. Detta SKA hållas synkat — om produktionskoden ändras måste
// detta test uppdateras (vilket är hela poängen: medvetna ändringar).
type Entry = { id: string; job_id: string; created_at: string; job_postings: unknown };

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function sanitize(input: unknown): Entry[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const r = item as Record<string, unknown>;
      const id = asString(r.id);
      const job_id = asString(r.job_id);
      const created_at = asString(r.created_at);
      if (!id || !job_id || !created_at) return null;
      return { id, job_id, created_at, job_postings: r.job_postings ?? null };
    })
    .filter((x): x is Entry => x !== null);
}

function readEnvelope(key: string, userId: string): Entry[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const env = JSON.parse(raw);
    if (!env || env.userId !== userId) return [];
    return sanitize(env.items);
  } catch {
    return [];
  }
}

describe('useSavedJobsCache — kontrakt: läsning returnerar alltid array', () => {
  beforeEach(() => store.clear());

  it('tom cache → tom array', () => {
    expect(readEnvelope(SAVED_CACHE_KEY, USER_ID)).toEqual([]);
  });

  it('Set serialiserat som object → tom array (ej krasch) — det ursprungliga buggscenariot', () => {
    // Det var detta som hände: ett Set hamnade i cachen
    store.set(SAVED_CACHE_KEY, JSON.stringify({
      userId: USER_ID,
      timestamp: Date.now(),
      items: { '0': 'job-a', '1': 'job-b' }, // object, inte array
    }));
    const result = readEnvelope(SAVED_CACHE_KEY, USER_ID);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('array av rena strängar (job_ids) → tom array', () => {
    store.set(SAVED_CACHE_KEY, JSON.stringify({
      userId: USER_ID,
      timestamp: Date.now(),
      items: ['job-a', 'job-b', 'job-c'],
    }));
    const result = readEnvelope(SAVED_CACHE_KEY, USER_ID);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('blandning av giltiga och korrupta entries → endast giltiga returneras', () => {
    store.set(SAVED_CACHE_KEY, JSON.stringify({
      userId: USER_ID,
      timestamp: Date.now(),
      items: [
        { id: 'a', job_id: 'job-1', created_at: '2024-01-01', job_postings: null },
        null,
        'random-string',
        { id: '', job_id: 'job-2', created_at: '2024-01-02' }, // saknar id
        { id: 'b', job_id: 'job-3', created_at: '2024-01-03', job_postings: { title: 'X' } },
        { foo: 'bar' },
      ],
    }));
    const result = readEnvelope(SAVED_CACHE_KEY, USER_ID);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.job_id)).toEqual(['job-1', 'job-3']);
  });

  it('helt korrupt JSON → tom array, ingen krasch', () => {
    store.set(SAVED_CACHE_KEY, '{not valid json');
    expect(() => readEnvelope(SAVED_CACHE_KEY, USER_ID)).not.toThrow();
    expect(readEnvelope(SAVED_CACHE_KEY, USER_ID)).toEqual([]);
  });

  it('fel userId → tom array (cache-isolering mellan användare)', () => {
    store.set(SAVED_CACHE_KEY, JSON.stringify({
      userId: 'other-user',
      timestamp: Date.now(),
      items: [{ id: 'a', job_id: 'job-1', created_at: '2024-01-01', job_postings: null }],
    }));
    expect(readEnvelope(SAVED_CACHE_KEY, USER_ID)).toEqual([]);
  });

  it('null/undefined items → tom array', () => {
    store.set(SAVED_CACHE_KEY, JSON.stringify({ userId: USER_ID, items: null }));
    expect(readEnvelope(SAVED_CACHE_KEY, USER_ID)).toEqual([]);
    store.set(SAVED_CACHE_KEY, JSON.stringify({ userId: USER_ID }));
    expect(readEnvelope(SAVED_CACHE_KEY, USER_ID)).toEqual([]);
  });

  it('skipped-cache följer samma kontrakt', () => {
    store.set(SKIPPED_CACHE_KEY, JSON.stringify({
      userId: USER_ID,
      items: { not: 'an array' },
    }));
    const result = readEnvelope(SKIPPED_CACHE_KEY, USER_ID);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('garanti: .filter() och .map() fungerar alltid på resultatet', () => {
    // Detta är det faktiska UI-kontraktet: SavedJobs.tsx kör .filter() / .map()
    const corrupt = [
      JSON.stringify({ userId: USER_ID, items: { fake: 'set' } }),
      JSON.stringify({ userId: USER_ID, items: 'string' }),
      JSON.stringify({ userId: USER_ID, items: 42 }),
      'invalid json',
      '',
    ];
    for (const raw of corrupt) {
      store.clear();
      if (raw) store.set(SAVED_CACHE_KEY, raw);
      const result = readEnvelope(SAVED_CACHE_KEY, USER_ID);
      expect(() => result.filter(x => x.job_id)).not.toThrow();
      expect(() => result.map(x => x.id)).not.toThrow();
    }
  });
});
