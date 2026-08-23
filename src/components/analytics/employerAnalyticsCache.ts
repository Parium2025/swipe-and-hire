import { safeSetItem } from '@/lib/safeStorage';

type AnalyticsCacheScope = 'overview' | 'advanced' | 'team';

type PersistedAnalyticsCacheEntry<T> = {
  timestamp: number;
  value: T;
};

const EMPLOYER_ANALYTICS_CACHE_PREFIX = 'parium-employer-analytics:v2';
const EMPLOYER_ANALYTICS_SELECTED_FILTER_KEY = 'parium-employer-analytics:selected-filter';
const VALID_FILTERS = new Set<number>([1, 7, 14, 30]);

const isPersistedEntry = <T,>(value: unknown): value is PersistedAnalyticsCacheEntry<T> => {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'timestamp' in (value as Record<string, unknown>) &&
      'value' in (value as Record<string, unknown>),
  );
};

export const getEmployerAnalyticsCacheKey = (
  scope: AnalyticsCacheScope,
  userId?: string,
  days?: number | null,
) => `${EMPLOYER_ANALYTICS_CACHE_PREFIX}:${scope}:${userId ?? 'guest'}:${days ?? 'all'}`;

/** Statistik äldre än detta kastas — vi visar hellre skelett än gamla siffror. */
export const EMPLOYER_ANALYTICS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const readEmployerAnalyticsCacheEntry = <T,>(
  key: string,
  maxAgeMs: number = EMPLOYER_ANALYTICS_CACHE_TTL_MS,
): { value: T; timestamp: number } | undefined => {
  if (typeof window === 'undefined') return undefined;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as T | PersistedAnalyticsCacheEntry<T>;
    if (!isPersistedEntry<T>(parsed)) {
      // Äldre format utan tidsstämpel — kan inte valideras, kasta det.
      window.localStorage.removeItem(key);
      return undefined;
    }

    const timestamp = Number(parsed.timestamp);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > maxAgeMs) {
      window.localStorage.removeItem(key);
      return undefined;
    }

    return { value: parsed.value, timestamp };
  } catch {
    return undefined;
  }
};

export const readEmployerAnalyticsCache = <T,>(key: string, maxAgeMs?: number): T | undefined =>
  readEmployerAnalyticsCacheEntry<T>(key, maxAgeMs)?.value;


export const writeEmployerAnalyticsCache = <T,>(key: string, value: T) => {
  if (typeof window === 'undefined') return false;

  return safeSetItem(
    key,
    JSON.stringify({
      timestamp: Date.now(),
      value,
    } satisfies PersistedAnalyticsCacheEntry<T>),
  );
};

export const readPersistedEmployerAnalyticsFilter = (): number | null => {
  if (typeof window === 'undefined') return 30;

  try {
    const raw = window.localStorage.getItem(EMPLOYER_ANALYTICS_SELECTED_FILTER_KEY);
    if (raw === 'all') return null;

    const parsed = Number(raw);
    return VALID_FILTERS.has(parsed) ? parsed : 30;
  } catch {
    return 30;
  }
};

export const persistEmployerAnalyticsFilter = (days: number | null) => {
  if (typeof window === 'undefined') return false;

  return safeSetItem(
    EMPLOYER_ANALYTICS_SELECTED_FILTER_KEY,
    days === null ? 'all' : String(days),
  );
};