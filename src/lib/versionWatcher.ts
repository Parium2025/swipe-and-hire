/**
 * Version Watcher — Spotify-style background freshness check.
 *
 * Två triggers (båda anropar samma deferred reload via appReloader):
 *  1. Visibility change: när användaren kommer tillbaka till tabben efter ≥2 min borta
 *  2. Heartbeat: var 5:e minut medan tabben är synlig
 *
 * Allt går genom requestAppReload('build-version', { defer: true }) → silent,
 * väntar tills idle/navigation/pagehide. Ingen avbruten användarinteraktion.
 *
 * Idempotent — säker att kalla flera gånger.
 */

import { requestAppReload, shortHash } from './appReloader';

const HEARTBEAT_INTERVAL_MS = 60 * 1000; // tät landing-check efter publish, utan manuell Safari-rensning
const MIN_CHECK_GAP_MS = 20 * 1000; // dubbletter-skydd

let installed = false;
let heartbeatId: ReturnType<typeof setInterval> | null = null;
let lastCheckAt = 0;

const log = (...args: unknown[]) => {
  try {
    if (typeof window !== 'undefined' && (window as any).__PARIUM_DEBUG_RELOAD) {
      console.log('[versionWatcher]', ...args);
    }
  } catch {
    /* noop */
  }
};

const getClientVersion = (): string | null => {
  try {
    const meta = document.querySelector('meta[name="parium-build"]');
    return meta?.getAttribute('content') ?? null;
  } catch {
    return null;
  }
};

const isLandingPage = (): boolean => {
  try {
    return window.location.pathname === '/' || window.location.pathname === '/index';
  } catch {
    return false;
  }
};

const checkVersion = async (reason: string): Promise<void> => {
  const now = Date.now();
  if (now - lastCheckAt < MIN_CHECK_GAP_MS) {
    log('skip — too soon since last check', reason);
    return;
  }
  lastCheckAt = now;

  const clientVersion = getClientVersion();
  if (!clientVersion) {
    log('skip — no client version (dev mode)');
    return;
  }

  try {
    const res = await fetch('/version.json', {
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.version) return;

    if (data.version === clientVersion) {
      log('version match — no reload needed', reason);
      return;
    }

    log('version mismatch — scheduling deferred reload', reason, {
      client: clientVersion,
      server: data.version,
    });

    requestAppReload('build-version', {
      defer: !isLandingPage(),
      purgeCaches: true,
      cacheBustParam: { key: '_v', value: shortHash(data.version) },
    });
  } catch {
    // offline eller temporär nätverksglitch — ignorera tyst
  }
};

const onVisibilityChange = (): void => {
  if (document.visibilityState === 'visible') {
    void checkVersion('visibility');
  }
};

const onWindowFocus = (): void => {
  void checkVersion('focus');
};

const onPageShow = (event: PageTransitionEvent): void => {
  void checkVersion(event.persisted ? 'pageshow-bfcache' : 'pageshow');
};

const onOnline = (): void => {
  void checkVersion('online');
};

const startHeartbeat = (): void => {
  if (heartbeatId !== null) return;
  heartbeatId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      void checkVersion('heartbeat');
    }
  }, HEARTBEAT_INTERVAL_MS);
};

export const installVersionWatcher = (): void => {
  if (installed) return;
  if (typeof window === 'undefined') return;
  installed = true;

  try {
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);
  } catch {
    /* noop */
  }

  startHeartbeat();
  void checkVersion('init');
  log('installed');
};
