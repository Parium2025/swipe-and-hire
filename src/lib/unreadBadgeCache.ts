/**
 * Delad cache för badge-siffran med olästa meddelanden.
 *
 * Skrivs till både sessionStorage (snabb, per flik) och localStorage
 * (överlever cold start, ny flik och app-omstart) så att badgen alltid är
 * "pre-warm" och renderas direkt vid uppstart — oavsett enhet eller plattform.
 */
export const UNREAD_MESSAGES_CACHE_KEY = 'parium_unread_messages';
export const JOB_SEEKER_UNREAD_MESSAGES_CACHE_KEY = 'parium_job_seeker_unread_messages';

const KEYS = [UNREAD_MESSAGES_CACHE_KEY, JOB_SEEKER_UNREAD_MESSAGES_CACHE_KEY] as const;

export type UnreadBadgeRole = 'employer' | 'job_seeker';

/**
 * Skriv totalen till rätt rolls nyckel. Utan roll skrivs båda — men då kan en
 * arbetsgivarsiffra skriva över jobbsökarens badge (och tvärtom) på ett konto
 * som växlar roll, så ange alltid roll när den är känd.
 */
export function writeUnreadBadgeCache(total: number, role?: UnreadBadgeRole): void {
  if (typeof window === 'undefined') return;
  const value = String(Math.max(0, Math.floor(Number(total) || 0)));
  const keys =
    role === 'employer'
      ? [UNREAD_MESSAGES_CACHE_KEY]
      : role === 'job_seeker'
        ? [JOB_SEEKER_UNREAD_MESSAGES_CACHE_KEY]
        : KEYS;
  for (const key of keys) {
    try { sessionStorage.setItem(key, value); } catch { /* privat läge */ }
    try { localStorage.setItem(key, value); } catch { /* privat läge */ }
  }
}

/** Läs cachad total: sessionStorage först, annars localStorage. */
export function readUnreadBadgeCache(key: string): number {
  if (typeof window === 'undefined') return 0;
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    } catch { /* privat läge */ }
  }
  return 0;
}
