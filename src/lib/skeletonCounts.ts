/**
 * Skeleton count cache — så laddnings-skeletonen rendrar exakt lika många
 * kort/rader som användaren faktiskt hade vid senaste renderingen på sidan.
 *
 * Mönstret:
 *   1. Sidan skriver `writeCachedCount(key, list.length)` när data laddat.
 *   2. Sidans skeleton läser `readCachedCount(key, fallback)` och rendrar
 *      exakt så många placeholder-shape-rader/kort.
 *
 * Clampas alltid till [0, max] så ett känt tomt resultat förblir tomt och vi
 * aldrig visar överväldigande många placeholders (max sätts per sida).
 */

export const SKELETON_COUNT_KEYS = {
  searchJobs: 'parium:searchJobs:lastCount',
  myApplicationsActive: 'parium:myApplications:activeLastCount',
  myApplicationsExpired: 'parium:myApplications:expiredLastCount',
  myApplicationsInterviews: 'parium:myApplications:interviewsLastCount',
  savedJobs: 'parium:savedJobs:lastCount',
  skippedJobs: 'parium:skippedJobs:lastCount',
  myCandidates: 'parium:myCandidates:lastCount',
  allCandidates: 'parium:allCandidates:lastCount',
  messages: 'parium:messages:lastCount',
  myJobsActive: 'parium:myJobs:activeLastCount',
  myJobsExpired: 'parium:myJobs:expiredLastCount',
  myJobsDraft: 'parium:myJobs:draftLastCount',
  // Företagets annonser (/dashboard) har egna antal — får aldrig dela nyckel
  // med Mina annonser, annars skriver sidorna över varandras skelett.
  orgJobsActive: 'parium:orgJobs:activeLastCount',
  orgJobsExpired: 'parium:orgJobs:expiredLastCount',
  jobTemplates: 'parium:jobTemplates:lastCount',
  supportTickets: 'parium:supportTickets:lastCount',
} as const;

const MY_CANDIDATES_COLD_LAYOUT_KEY = 'parium:myCandidates:coldLayout';

export function readCachedCount(key: string, fallback = 6, max = 9): number {
  if (typeof window === 'undefined') return fallback;
  try {
    // Prefer localStorage (persists across app restarts) but fall back to
    // sessionStorage for backwards compat with earlier writes this session.
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (!raw) return fallback;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return fallback;
    if (n === 0) return 0;
    return Math.min(max, Math.max(1, n));
  } catch {
    return fallback;
  }
}

export function writeCachedCount(key: string, n: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, String(Math.max(0, Math.floor(n))));
  } catch {
    /* noop */
  }
}

/**
 * Kolumnlayout för Mina kandidater: antal kort per steg i visningsordning.
 * Nyckeln måste vara unik per konto och lista — annars kan en annan lista eller
 * en tidigare inloggad användare ge fel antal kolumner vid nästa kallstart.
 */
export function myCandidatesLayoutKey(
  userId: string | undefined | null,
  listId: string | undefined | null,
): string | null {
  if (!userId) return null;
  return `parium:myCandidates:stageLayout:${userId}:${listId ?? 'default'}`;
}

export function readCachedLayout(key: string): number[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0 || arr.length > 30) return null;
    return arr.map((n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0));
  } catch {
    return null;
  }
}

export function writeCachedLayout(key: string, counts: number[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(counts.map((n) => Math.max(0, Math.floor(n)))));
  } catch {
    /* noop */
  }
}

/**
 * The auth shell renders before the session user is available. Keep one
 * short-lived pointer to the last fully resolved employer board so that this
 * first frame can mirror it. Logout clears the whole `parium:myCandidates:`
 * namespace, so another account never inherits the snapshot.
 */
export function readMyCandidatesColdLayout(): number[] | null {
  return readCachedLayout(MY_CANDIDATES_COLD_LAYOUT_KEY);
}

export function writeMyCandidatesColdLayout(counts: number[]): void {
  writeCachedLayout(MY_CANDIDATES_COLD_LAYOUT_KEY, counts);
}
