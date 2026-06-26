/**
 * 🌐 CONNECTIVITY MANAGER — Apple-grade
 *
 * Mål: Banneret "Offline" får ALDRIG visas när användaren faktiskt har nät.
 *
 * Designprinciper:
 *  1. Quorum av flera endpoints (favicon + Supabase). Kräver att ≥2 misslyckas
 *     samtidigt innan vi ens överväger offline.
 *  2. Image-ping istället för fetch där det går — robustare på iOS Safari.
 *  3. Exponential backoff vid offline (1s → 2s → 5s → 10s → 30s).
 *  4. Adaptiv timeout via Network Information API (långsamt nät → längre timeout).
 *  5. Pausar pings när fliken är dold (sparar batteri, undviker bfcache-falsklarm).
 *  6. "Soft" vs "hard" offline — banner visas BARA vid hard offline.
 *  7. Graceful degradation — vid osäkerhet, anta online.
 *
 * Publikt API är OFÖRÄNDRAT — inget annat i appen påverkas.
 */

import { onlineManager, type QueryClient } from '@tanstack/react-query';

// ─── State ────────────────────────────────────────────────────────

let _isActuallyOnline = navigator.onLine;
let _listeners = new Set<(online: boolean) => void>();
let _heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
let _queryClient: QueryClient | null = null;
let _checkVersion = 0;
let _consecutiveFailures = 0;
let _inflightCheck: Promise<boolean> | null = null;
let _initialized = false;
let _pageVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

// ─── Tuning ──────────────────────────────────────────────────────

const HEARTBEAT_ONLINE = 30_000; // 30s when healthy
// Backoff steps when offline — gentle, not aggressive
const BACKOFF_OFFLINE_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

const PING_TIMEOUT_DEFAULT = 8_000;
const PING_TIMEOUT_SLOW = 15_000; // 2g / slow-2g

// "Hard offline" requires this many consecutive quorum-failed checks
// AND navigator.onLine === false, OR this many failures regardless.
const HARD_OFFLINE_FAILS_WITH_BROWSER_FLAG = 2;
const HARD_OFFLINE_FAILS_OVERRIDE = 5;

// ─── Helpers ─────────────────────────────────────────────────────

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getAdaptiveTimeout(): number {
  try {
    const conn = (navigator as any).connection;
    const eff = conn?.effectiveType as string | undefined;
    if (eff === '2g' || eff === 'slow-2g') return PING_TIMEOUT_SLOW;
  } catch {
    /* ignore */
  }
  return PING_TIMEOUT_DEFAULT;
}

/** Image-based ping — most robust on iOS Safari (no fetch/CORS/SW edge cases). */
function pingImage(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(false);
      return;
    }
    let settled = false;
    const img = new Image();
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      img.src = ''; // cancel
      resolve(false);
    }, timeoutMs);
    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // onerror at the network layer still means we reached the network.
      // But Image can't distinguish DNS-fail from 404, so treat as failure here.
      resolve(false);
    };
    img.src = url;
  });
}

/** Fetch-based ping as secondary signal. Any HTTP response = reachable. */
async function pingFetch(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'omit',
      mode: 'no-cors',
      signal: controller.signal,
    });
    // In no-cors mode response.type is "opaque" and status is 0, but reaching
    // here at all means the network responded.
    return res.type === 'opaque' || res.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Quorum check — pings several endpoints in parallel.
 * Returns true if ANY endpoint responds (we have internet).
 * Returns false only when ALL endpoints fail (likely offline).
 */
async function checkConnectivityQuorum(): Promise<boolean> {
  const timeout = getAdaptiveTimeout();
  const cb = Date.now();
  const origin = window.location.origin;

  // Endpoint 1: own favicon via Image (most robust on iOS)
  const ownImage = pingImage(`${origin}/favicon-parium.png?_cb=${cb}`, timeout);

  // Endpoint 2: own favicon via fetch HEAD (different code path)
  const ownFetch = pingFetch(`${origin}/favicon-parium.png?_cb=${cb}_f`, timeout);

  // Endpoint 3: external robust endpoint (works even if our origin is down)
  // Google's generate_204 is purpose-built for connectivity checks, tiny, no-cors safe.
  const externalFetch = pingFetch(`https://www.google.com/generate_204?_cb=${cb}`, timeout);

  // Race: as soon as ANY succeeds, we know we're online.
  return new Promise<boolean>((resolve) => {
    let remaining = 3;
    let anySuccess = false;
    const onResult = (ok: boolean) => {
      if (ok && !anySuccess) {
        anySuccess = true;
        resolve(true);
        return;
      }
      remaining -= 1;
      if (remaining === 0 && !anySuccess) {
        resolve(false);
      }
    };
    ownImage.then(onResult).catch(() => onResult(false));
    ownFetch.then(onResult).catch(() => onResult(false));
    externalFetch.then(onResult).catch(() => onResult(false));
  });
}

/**
 * Single-flight wrapper — multiple concurrent callers share the same check.
 */
function singleFlightCheck(): Promise<boolean> {
  if (_inflightCheck) return _inflightCheck;
  _inflightCheck = checkConnectivityQuorum().finally(() => {
    _inflightCheck = null;
  });
  return _inflightCheck;
}

// ─── State transitions ──────────────────────────────────────────

function setOnlineState(online: boolean) {
  if (online) _consecutiveFailures = 0;

  const changed = _isActuallyOnline !== online;
  _isActuallyOnline = online;

  // Always keep TanStack in sync
  onlineManager.setOnline(online);

  if (changed) {
    _listeners.forEach((fn) => {
      try {
        fn(online);
      } catch {
        /* listener errors must not break others */
      }
    });

    if (online && _queryClient) {
      _queryClient.refetchQueries({
        type: 'all',
        predicate: (q) => q.state.status === 'error',
      });
    }
  }

  scheduleNextHeartbeat();
}

/**
 * Core check + decide whether to flip state.
 * "Hard offline" criteria (only then do we show the banner):
 *  - Quorum failed AND navigator.onLine === false AND ≥ HARD_OFFLINE_FAILS_WITH_BROWSER_FLAG failures, OR
 *  - Quorum failed ≥ HARD_OFFLINE_FAILS_OVERRIDE times in a row.
 *
 * If quorum failed but we're not yet "hard offline" → STAY online (soft offline).
 * This is the key Apple-grade behavior: don't alarm the user on transient glitches.
 */
async function runCheck(): Promise<boolean> {
  const version = ++_checkVersion;
  const online = await singleFlightCheck();

  // Stale check — newer one in flight
  if (version !== _checkVersion) return online;

  if (online) {
    setOnlineState(true);
    return true;
  }

  // Quorum says no. Increment failure counter.
  _consecutiveFailures += 1;

  const browserSaysOffline = !navigator.onLine;
  const hardOffline =
    (browserSaysOffline && _consecutiveFailures >= HARD_OFFLINE_FAILS_WITH_BROWSER_FLAG) ||
    _consecutiveFailures >= HARD_OFFLINE_FAILS_OVERRIDE;

  if (hardOffline) {
    setOnlineState(false);
    return false;
  }

  // Soft offline — quorum failed but we trust the network is probably still there.
  // Don't change state. Schedule another check sooner.
  scheduleNextHeartbeat();
  return _isActuallyOnline;
}

// ─── Heartbeat scheduling ───────────────────────────────────────

function scheduleNextHeartbeat() {
  if (_heartbeatTimer) {
    clearTimeout(_heartbeatTimer);
    _heartbeatTimer = null;
  }

  // Pause when tab is hidden — save battery, avoid bfcache false-positives
  if (!_pageVisible) return;

  let delay: number;
  if (_isActuallyOnline && _consecutiveFailures === 0) {
    delay = HEARTBEAT_ONLINE;
  } else {
    // Backoff steps for offline / soft-offline
    const idx = Math.min(_consecutiveFailures, BACKOFF_OFFLINE_MS.length - 1);
    delay = BACKOFF_OFFLINE_MS[Math.max(idx, 0)];
  }

  _heartbeatTimer = setTimeout(() => {
    _heartbeatTimer = null;
    void runCheck();
  }, delay);
}

// ─── Public API (UNCHANGED) ─────────────────────────────────────

export function initConnectivityManager(queryClient: QueryClient) {
  if (_initialized) {
    _queryClient = queryClient;
    return;
  }
  _initialized = true;
  _queryClient = queryClient;

  onlineManager.setEventListener((setOnline) => {
    const handleOnline = () => {
      // Browser regained network — optimistically flip on, then verify
      setOnlineState(true);
      setOnline(true);
      void runCheck();
    };
    const handleOffline = () => {
      // Browser is authoritative when it says offline
      _consecutiveFailures = Math.max(_consecutiveFailures, HARD_OFFLINE_FAILS_WITH_BROWSER_FLAG);
      setOnlineState(false);
      setOnline(false);
    };
    const handleVisibility = () => {
      _pageVisible = document.visibilityState === 'visible';
      if (_pageVisible) {
        // Returning to the tab — verify before trusting cached state
        void runCheck();
      } else {
        // Hide — pause heartbeat
        if (_heartbeatTimer) {
          clearTimeout(_heartbeatTimer);
          _heartbeatTimer = null;
        }
      }
    };
    const handleFocus = () => {
      void runCheck();
    };
    const handlePageShow = () => {
      // bfcache restore — always re-verify
      void runCheck();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);

    // React to network-quality changes (timeout adapts on next ping)
    try {
      const conn = (navigator as any).connection;
      conn?.addEventListener?.('change', () => void runCheck());
    } catch {
      /* ignore */
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
    };
  });

  // Initial verification + first heartbeat
  void runCheck();
  scheduleNextHeartbeat();
}

export function onConnectivityChange(listener: (online: boolean) => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

export function getIsOnline(): boolean {
  return _isActuallyOnline;
}

export async function forceConnectivityCheck(): Promise<boolean> {
  return runCheck();
}
