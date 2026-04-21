/**
 * One-time localStorage cleanup som rensar gamla cache-prefix.
 *
 * Bunden till build-signaturen (Vites asset-hashar) så den triggas automatiskt
 * vid varje ny deploy — ingen manuell version-bumpning behövs.
 *
 * BASE_VERSION används bara som fallback om signaturen inte kan beräknas (dev).
 */

const BASE_VERSION = 'v5';
const VERSION_KEY = 'parium_cache_version';

const STALE_PREFIXES = [
  'parium_my_applications_cache',
  'parium_company_data_cache_v2',
  'parium_company_data_cache_v3',
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

const computeBuildSig = (): string => {
  try {
    if (typeof document === 'undefined') return BASE_VERSION;
    const scripts = Array.from(document.querySelectorAll('script[src]'))
      .map((s) => (s as HTMLScriptElement).getAttribute('src') || '')
      .filter((src) => /\/assets\/.+\.(js|mjs)/.test(src));
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
      .map((l) => (l as HTMLLinkElement).getAttribute('href') || '')
      .filter((href) => /\/assets\/.+\.css/.test(href));
    const all = [...scripts, ...styles].sort();
    if (all.length === 0) return BASE_VERSION;
    // Kort hash av signaturen
    let hash = 0;
    const joined = all.join('|');
    for (let i = 0; i < joined.length; i++) {
      hash = ((hash << 5) - hash + joined.charCodeAt(i)) | 0;
    }
    return `${BASE_VERSION}-${Math.abs(hash)}`;
  } catch {
    return BASE_VERSION;
  }
};

export function nukeStaleCaches(): void {
  try {
    const currentVersion = computeBuildSig();
    const stored = localStorage.getItem(VERSION_KEY);
    if (stored === currentVersion) return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (STALE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    });

    localStorage.setItem(VERSION_KEY, currentVersion);

    if (keysToRemove.length > 0) {
      console.log(`[cacheNuke] Cleared ${keysToRemove.length} stale cache entries`);
    }
  } catch {
    // ignore — never block app start
  }
}
