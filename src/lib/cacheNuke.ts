/**
 * One-time localStorage cleanup to remove stale caches from before the
 * "single tunnel" architecture (where job_postings is the source of truth
 * for workplace_name and company_logo_url).
 *
 * Bump CACHE_VERSION whenever you need to force-evict old caches for all users.
 */

const CACHE_VERSION = 'v3-2026-04-19-single-tunnel';
const VERSION_KEY = 'parium_cache_version';

const STALE_PREFIXES = [
  'parium_my_applications_cache',
  'job_seeker_applications_',
  'job_seeker_available_jobs_',
  'job_seeker_messages_',
  'job_seeker_interviews_',
  'job-details-cache-',
  'jobs_snapshot_',
  'applications_snapshot_',
  'candidate-profile-',
  'eager_preload_',
];

export function nukeStaleCaches(): void {
  try {
    const current = localStorage.getItem(VERSION_KEY);
    if (current === CACHE_VERSION) return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (STALE_PREFIXES.some(prefix => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    });

    localStorage.setItem(VERSION_KEY, CACHE_VERSION);

    if (keysToRemove.length > 0) {
      console.log(`[cacheNuke] Cleared ${keysToRemove.length} stale cache entries`);
    }
  } catch {
    // ignore — never block app start
  }
}
