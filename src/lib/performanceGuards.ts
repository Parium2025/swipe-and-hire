import { supabase } from '@/integrations/supabase/client';
import { safeReadJsonCache, safeSetItem } from '@/lib/safeStorage';

type CacheEnvelope<T> = {
  data: T;
  timestamp: number;
  version: number;
};

type ProfileLite = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  profile_image_url: string | null;
  company_logo_url: string | null;
  role: 'job_seeker' | 'employer';
};

const CACHE_VERSION = 1;
const PROFILE_TTL_MS = 15 * 60 * 1000;
const memoryCache = new Map<string, { data: unknown; timestamp: number }>();
const inFlight = new Map<string, Promise<unknown>>();
const rateQueues = new Map<string, Promise<unknown>>();
const lastRunAt = new Map<string, number>();

function isFresh(timestamp: number, ttlMs: number): boolean {
  return Number.isFinite(timestamp) && Date.now() - timestamp < ttlMs;
}

export function readPersistentCache<T>(
  key: string,
  ttlMs: number,
  validate: (data: unknown) => data is T,
): T | null {
  const memory = memoryCache.get(key);
  if (memory && isFresh(memory.timestamp, ttlMs) && validate(memory.data)) return memory.data;

  const envelope = safeReadJsonCache<CacheEnvelope<T>>(
    key,
    (value): value is CacheEnvelope<T> => {
      const candidate = value as CacheEnvelope<T>;
      return Boolean(
        candidate &&
        candidate.version === CACHE_VERSION &&
        typeof candidate.timestamp === 'number' &&
        validate(candidate.data)
      );
    },
  );

  if (!envelope || !isFresh(envelope.timestamp, ttlMs)) return null;
  memoryCache.set(key, { data: envelope.data, timestamp: envelope.timestamp });
  return envelope.data;
}

export function writePersistentCache<T>(key: string, data: T): void {
  const timestamp = Date.now();
  memoryCache.set(key, { data, timestamp });
  safeSetItem(key, JSON.stringify({ data, timestamp, version: CACHE_VERSION }));
}

export async function readThroughCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  validate: (data: unknown) => data is T,
): Promise<T> {
  const cached = readPersistentCache<T>(key, ttlMs, validate);
  if (cached !== null) return cached;

  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const pending = loader().then((data) => {
    if (validate(data)) writePersistentCache(key, data);
    return data;
  }).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, pending);
  return pending;
}

export async function rateLimited<T>(key: string, minIntervalMs: number, task: () => Promise<T>): Promise<T> {
  const previous = rateQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const elapsed = Date.now() - (lastRunAt.get(key) ?? 0);
    if (elapsed < minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, minIntervalMs - elapsed));
    }
    lastRunAt.set(key, Date.now());
    return task();
  });
  rateQueues.set(key, next.finally(() => {
    if (rateQueues.get(key) === next) rateQueues.delete(key);
  }));
  return next;
}

function isProfileLite(data: unknown): data is ProfileLite {
  const profile = data as ProfileLite;
  return Boolean(profile && typeof profile === 'object' && typeof profile.user_id === 'string');
}

export async function fetchCachedProfiles(userIds: string[]): Promise<Map<string, ProfileLite>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, ProfileLite>();
  const missing: string[] = [];

  uniqueIds.forEach((userId) => {
    const cached = readPersistentCache<ProfileLite>(`parium_profile_lite_v1_${userId}`, PROFILE_TTL_MS, isProfileLite);
    if (cached) result.set(userId, cached);
    else missing.push(userId);
  });

  if (missing.length === 0) return result;

  const { data, error } = await rateLimited('profiles-batch-read', 100, () => supabase
    .from('profiles')
    .select('user_id, first_name, last_name, company_name, profile_image_url, company_logo_url, role')
    .in('user_id', missing));

  if (error) throw error;

  (data || []).forEach((profile) => {
    if (!isProfileLite(profile)) return;
    result.set(profile.user_id, profile);
    writePersistentCache(`parium_profile_lite_v1_${profile.user_id}`, profile);
  });

  return result;
}

export async function fetchCachedProfile(userId: string): Promise<ProfileLite | null> {
  const profiles = await fetchCachedProfiles([userId]);
  return profiles.get(userId) ?? null;
}