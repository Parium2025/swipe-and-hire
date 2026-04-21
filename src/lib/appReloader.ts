/**
 * Central reload coordinator
 *
 * En enda väg in för all "ladda om appen"-logik. Skyddar mot:
 *  - Loopar (global lock i sessionStorage, 10s)
 *  - Dubbel-reloads från flera källor samtidigt
 *  - Avbruten användarinteraktion (deferred mode → vänta tills idle/navigation)
 *
 * Användning:
 *   import { requestAppReload } from '@/lib/appReloader';
 *   requestAppReload('build-version');           // omedelbar (med lock)
 *   requestAppReload('build-version', { defer: true }); // tyst, vänta tills idle
 */

export type ReloadReason =
  | 'build-version'
  | 'chunk-error'
  | 'user-action'
  | 'gps-permission'
  | 'cv-retry';

interface ReloadOptions {
  /** Vänta tills användaren är idle eller navigerar (Spotify-style). Default: false */
  defer?: boolean;
  /** Cache-bust query param att lägga till URL */
  cacheBustParam?: { key: string; value: string };
  /** Avregistrera service workers + rensa caches innan reload */
  purgeCaches?: boolean;
}

const LOCK_KEY = 'parium_reload_lock';
const LOCK_TTL_MS = 10_000;
const IDLE_DELAY_MS = 30_000;

const log = (...args: unknown[]) => {
  try {
    if (typeof window !== 'undefined' && (window as any).__PARIUM_DEBUG_RELOAD) {
      console.log('[appReloader]', ...args);
    }
  } catch {
    /* noop */
  }
};

const isLocked = (): boolean => {
  try {
    const lock = sessionStorage.getItem(LOCK_KEY);
    if (!lock) return false;
    const ts = parseInt(lock, 10);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < LOCK_TTL_MS;
  } catch {
    return false;
  }
};

const acquireLock = (): boolean => {
  try {
    if (isLocked()) return false;
    sessionStorage.setItem(LOCK_KEY, String(Date.now()));
    return true;
  } catch {
    return true; // Fallthrough — om sessionStorage saknas, tillåt reload
  }
};

const purgeRuntimeCaches = async (): Promise<void> => {
  try {
    if (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      navigator.serviceWorker.getRegistrations
    ) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
    if (typeof caches !== 'undefined' && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    /* noop */
  }
};

const performReload = (opts: ReloadOptions): void => {
  try {
    if (opts.cacheBustParam) {
      const url = new URL(window.location.href);
      url.searchParams.set(opts.cacheBustParam.key, opts.cacheBustParam.value);
      if (window.location.href !== url.toString()) {
        window.location.replace(url.toString());
        return;
      }
    }
    window.location.reload();
  } catch {
    try {
      window.location.reload();
    } catch {
      /* sista utvägen */
    }
  }
};

let deferredScheduled = false;

const scheduleDeferredReload = (opts: ReloadOptions): void => {
  if (deferredScheduled) return;
  deferredScheduled = true;
  log('deferred reload scheduled');

  let executed = false;
  const fire = () => {
    if (executed) return;
    executed = true;
    if (!acquireLock()) {
      log('deferred fire skipped — lock held');
      return;
    }
    log('deferred fire executing');
    if (opts.purgeCaches) {
      void purgeRuntimeCaches().finally(() => performReload(opts));
    } else {
      performReload(opts);
    }
  };

  // 1. Vid nästa SPA-navigation (history change)
  const onNavigate = () => fire();
  try {
    window.addEventListener('popstate', onNavigate, { once: true });
  } catch {
    /* noop */
  }

  // 2. Vid tab hidden → visible övergång (säkrast — användaren är inte mitt i något)
  const onVisible = () => {
    if (document.visibilityState === 'hidden') {
      // När de kommer tillbaka, reload
      const onceVisible = () => {
        document.removeEventListener('visibilitychange', onceVisible);
        fire();
      };
      document.addEventListener('visibilitychange', onceVisible);
    }
  };
  try {
    document.addEventListener('visibilitychange', onVisible);
  } catch {
    /* noop */
  }

  // 3. Idle fallback — om inget hänt på 30s
  try {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => setTimeout(fire, IDLE_DELAY_MS), {
        timeout: IDLE_DELAY_MS + 5000,
      });
    } else {
      setTimeout(fire, IDLE_DELAY_MS);
    }
  } catch {
    setTimeout(fire, IDLE_DELAY_MS);
  }
};

/**
 * Begär en app-reload. Säker att anropa flera gånger — locket förhindrar dubbletter.
 */
export const requestAppReload = (reason: ReloadReason, options: ReloadOptions = {}): void => {
  log('requestAppReload', reason, options);

  if (isLocked()) {
    log('skipped — lock held');
    return;
  }

  if (options.defer) {
    scheduleDeferredReload(options);
    return;
  }

  if (!acquireLock()) {
    log('skipped — could not acquire lock');
    return;
  }

  if (options.purgeCaches) {
    void purgeRuntimeCaches().finally(() => performReload(options));
  } else {
    performReload(options);
  }
};

/**
 * Räkna ut en build-signatur från Vites hashade asset-URL:er i DOM.
 * Returnerar null om inga hashade assets hittas (dev-läge).
 */
export const computeBuildSignature = (): string | null => {
  try {
    if (typeof document === 'undefined') return null;
    const scripts = Array.from(document.querySelectorAll('script[src]'))
      .map((s) => (s as HTMLScriptElement).getAttribute('src') || '')
      .filter((src) => /\/assets\/.+\.(js|mjs)/.test(src));
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
      .map((l) => (l as HTMLLinkElement).getAttribute('href') || '')
      .filter((href) => /\/assets\/.+\.css/.test(href));
    const all = [...scripts, ...styles].sort();
    return all.length > 0 ? all.join('|') : null;
  } catch {
    return null;
  }
};

/**
 * Kort hash av en sträng — används för cache-bust query params.
 */
export const shortHash = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash)).slice(0, 10);
};
