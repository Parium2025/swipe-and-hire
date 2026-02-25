/**
 * Candidate Profile Cache — persistent localStorage + in-memory caching
 * for immutable application data (questions, summaries) and mutable data (notes).
 */

export interface CandidateNote {
  id: string;
  note: string;
  created_at: string;
  employer_id: string;
  author_name?: string;
}

export type CandidateSummaryCacheValue = {
  summary_text: string;
  key_points: { text: string; type?: 'positive' | 'negative' | 'neutral' }[] | null;
  document_type?: string | null;
  is_valid_cv?: boolean;
};

type PersistedCacheEntry<T> = {
  value: T;
  cachedAt: number;
};

const SUMMARY_STORAGE_KEY = 'candidate-profile-summary-cache-v1';
const QUESTIONS_STORAGE_KEY = 'candidate-profile-questions-cache-v1';
const NOTES_STORAGE_KEY = 'candidate-profile-notes-cache-v1';
const CACHE_MAX_ITEMS = 400;

const isBrowser = () => typeof window !== 'undefined';

// ─── Generic localStorage helpers ───────────────────────────────────

const readPersistedCache = <T,>(storageKey: string): Record<string, PersistedCacheEntry<T>> => {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writePersistedCache = <T,>(storageKey: string, cache: Record<string, PersistedCacheEntry<T>>) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(cache));
  } catch {
    // Ignore storage errors silently
  }
};

export const getPersistedCacheValue = <T,>(storageKey: string, cacheKey: string): T | null => {
  const cache = readPersistedCache<T>(storageKey);
  const entry = cache[cacheKey];
  if (!entry) return null;
  // Permanent cache – application data is immutable after submission
  return entry.value;
};

export const setPersistedCacheValue = <T,>(storageKey: string, cacheKey: string, value: T) => {
  const cache = readPersistedCache<T>(storageKey);
  cache[cacheKey] = { value, cachedAt: Date.now() };

  const pruned = Object.fromEntries(
    Object.entries(cache)
      .sort(([, a], [, b]) => b.cachedAt - a.cachedAt)
      .slice(0, CACHE_MAX_ITEMS)
  ) as Record<string, PersistedCacheEntry<T>>;

  writePersistedCache(storageKey, pruned);
};

// ─── Module-level in-memory caches (survive dialog open/close) ──────

export const summaryCache = new Map<string, CandidateSummaryCacheValue>();
export const questionsCache = new Map<string, Record<string, { text: string; order: number }>>();
export const notesCache = new Map<string, CandidateNote[]>();

// ─── Storage key constants (re-exported for consumers) ──────────────

export { SUMMARY_STORAGE_KEY, QUESTIONS_STORAGE_KEY, NOTES_STORAGE_KEY };

// ─── Notes-specific helpers ─────────────────────────────────────────

export const getPersistedNotes = (applicantId: string): CandidateNote[] | null => {
  return getPersistedCacheValue<CandidateNote[]>(NOTES_STORAGE_KEY, applicantId);
};

export const setPersistedNotes = (applicantId: string, notes: CandidateNote[]) => {
  setPersistedCacheValue(NOTES_STORAGE_KEY, applicantId, notes);
};
