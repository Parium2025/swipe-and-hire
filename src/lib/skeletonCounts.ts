/**
 * Skeleton count cache — så laddnings-skeletonen rendrar exakt lika många
 * kort/rader som användaren faktiskt hade vid senaste renderingen på sidan.
 *
 * Mönstret:
 *   1. Sidan skriver `writeCachedCount(key, list.length)` när data laddat.
 *   2. Sidans skeleton läser `readCachedCount(key, fallback)` och rendrar
 *      exakt så många placeholder-shape-rader/kort.
 *
 * Clampas alltid till [1, max] så vi aldrig visar tomt eller överväldigande
 * många placeholders (max sätts per sida, default 9).
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
  jobTemplates: 'parium:jobTemplates:lastCount',
  supportTickets: 'parium:supportTickets:lastCount',
} as const;

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
