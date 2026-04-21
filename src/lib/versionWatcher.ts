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

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minuter
const VISIBILITY_RECHECK_MS = 2 * 60 * 1000; // bara recheck om borta ≥2 min
const MIN_CHECK_GAP_MS = 60 * 1000; // dubbletter-skydd: max 1 fetch/min

let installed = false;
let heartbeatId: ReturnType<typeof setInterval> | null = null;
let lastCheckAt = 0;
let lastHiddenAt = 0;

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
      defer: true,
      purgeCaches: true,
      cacheBustParam: { key: '_v', value: shortHash(data.version) },
    });
  } catch {
    // offline eller temporär nätverksglitch — ignorera tyst
  }
};

const onVisibilityChange = (): void => {
  if (document.visibilityState === 'hidden') {
    lastHiddenAt = Date.now();
    return;
  }

  // visible — kolla om vi varit borta länge nog att det är värt att checka
  const awayFor = lastHiddenAt > 0 ? Date.now() - lastHiddenAt : 0;
  if (awayFor >= VISIBILITY_RECHECK_MS) {
    void checkVersion(`visibility (away ${Math.round(awayFor / 1000)}s)`);
  }
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
  } catch {
    /* noop */
  }

  startHeartbeat();
  log('installed');
};
