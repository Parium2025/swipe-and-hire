/**
 * Användarbunden localStorage-cache för jobbsökarens statistikkort.
 *
 * Tidigare låg siffrorna på en global nyckel utan user-id, vilket gjorde att
 * nästa konto på en delad enhet kunde se föregående kontos räknare i första
 * frame. Nycklarna är nu strikt bundna till användarens id och den gamla
 * globala nyckeln rensas vid första läsning.
 */

import { safeSetItem } from '@/lib/safeStorage';

export const JOBSEEKER_STATS_CACHE_PREFIX = 'parium-jobseeker-stats:v2:';
export const LEGACY_JOBSEEKER_STATS_KEY = 'parium-jobseeker-stats';

const purgeLegacyKey = () => {
  try {
    localStorage.removeItem(LEGACY_JOBSEEKER_STATS_KEY);
  } catch {
    /* ignore */
  }
};

const keyFor = (userId: string) => `${JOBSEEKER_STATS_CACHE_PREFIX}${userId}`;

/**
 * Läser cachade statistikvärden för EN användare.
 * Returnerar alltid ett objekt — aldrig null, aldrig annan användares data.
 */
export function readCachedStats(userId?: string | null): Record<string, number> {
  // Legacy-värden kan tillhöra fel konto → migreras aldrig, bara bort.
  purgeLegacyKey();
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      try { localStorage.removeItem(keyFor(userId)); } catch { /* ignore */ }
      return {};
    }
    const result: Record<string, number> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    });
    return result;
  } catch {
    try { localStorage.removeItem(keyFor(userId)); } catch { /* ignore */ }
    return {};
  }
}

/**
 * Skriver ett enskilt statistikvärde för EN användare.
 * No-op när användare saknas (utloggad) — inget får hamna på en delad nyckel.
 */
export function writeCachedStat(userId: string | null | undefined, key: string, value: number): void {
  if (!userId) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  try {
    const current = readCachedStats(userId);
    current[key] = value;
    safeSetItem(keyFor(userId), JSON.stringify(current));
  } catch {
    /* ignore */
  }
}
