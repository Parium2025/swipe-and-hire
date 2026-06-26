/**
 * 🌐 CONNECTIVITY MANAGER
 * 
 * Provides reliable connectivity detection beyond navigator.onLine.
 * navigator.onLine is notoriously unreliable — it returns true behind
 * captive portals, dead routers, etc. This module adds a lightweight
 * heartbeat ping to verify actual internet access.
 * 
 * Also integrates with TanStack React Query's onlineManager so that
 * queries are automatically paused when offline and resumed on reconnect.
 */

import { onlineManager, type QueryClient } from '@tanstack/react-query';

// ─── State ────────────────────────────────────────────────────────

let _isActuallyOnline = navigator.onLine;
let _listeners = new Set<(online: boolean) => void>();
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _queryClient: QueryClient | null = null;
let _connectivityCheckVersion = 0;
let _pendingOfflineTimer: ReturnType<typeof setTimeout> | null = null;
let _consecutiveFailures = 0;

// ─── Heartbeat ping ──────────────────────────────────────────────

const HEARTBEAT_INTERVAL = 30_000; // 30s when online
const HEARTBEAT_INTERVAL_OFFLINE = 3_000; // 3s when offline (check more frequently)
const PING_TIMEOUT = 8_000; // Generous — mobile networks can be slow
const OFFLINE_CONFIRMATION_DELAY = 2500; // Wait longer before confirming offline
const CONNECTIVITY_RETRY_DELAY = 500;
// Require this many consecutive failed pings before declaring offline
// (prevents false offline-states from transient mobile network glitches)
const REQUIRED_FAILURES_TO_GO_OFFLINE = 3;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Lightweight connectivity check.
 * Uses a HEAD request to the app's own origin (no CORS issues, tiny payload).
 * Falls back to navigator.onLine if the request errors in an ambiguous way.
 */
async function checkConnectivity(): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), PING_TIMEOUT);

      // Ping our own origin with cache-busting to avoid SW/CDN caches.
      // Avoid trusting navigator.onLine here because it can lag after rapid toggles.
      const response = await fetch(`${window.location.origin}/favicon-parium.png?_cb=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });

      // Any HTTP response means we successfully reached the origin.
      return response.status > 0;
    } catch (err: any) {
      const isRetryableFailure = err?.name === 'AbortError' || err instanceof TypeError;

      if (attempt === 0 && isRetryableFailure && navigator.onLine) {
        await wait(CONNECTIVITY_RETRY_DELAY);
        continue;
      }

      if (err?.name === 'AbortError') return false;
      if (err instanceof TypeError) return false;
      return navigator.onLine;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return false;
}

/**
 * Run connectivity check with race protection.
 * Only the latest in-flight check is allowed to update global state.
 */
async function runConnectivityCheck(): Promise<boolean> {
  const version = ++_connectivityCheckVersion;
  const online = await checkConnectivity();

  if (version !== _connectivityCheckVersion) {
    return online;
  }

  if (online) {
    _consecutiveFailures = 0;
    if (_pendingOfflineTimer) {
      clearTimeout(_pendingOfflineTimer);
      _pendingOfflineTimer = null;
    }
    setOnlineState(true);
    return true;
  }

  // Ping failed. If browser still says it's online, treat this as a transient
  // glitch unless we've had several consecutive failures in a row.
  _consecutiveFailures += 1;

  if (navigator.onLine && _consecutiveFailures < REQUIRED_FAILURES_TO_GO_OFFLINE) {
    // Don't flip to offline yet — schedule another check soon
    if (_pendingOfflineTimer) clearTimeout(_pendingOfflineTimer);
    _pendingOfflineTimer = setTimeout(() => {
      _pendingOfflineTimer = null;
      void runConnectivityCheck();
    }, OFFLINE_CONFIRMATION_DELAY);
    return _isActuallyOnline;
  }

  if (!_isActuallyOnline) {
    setOnlineState(false);
    return false;
  }

  if (_pendingOfflineTimer) {
    clearTimeout(_pendingOfflineTimer);
  }

  _pendingOfflineTimer = setTimeout(async () => {
    if (version !== _connectivityCheckVersion) return;

    const confirmedOnline = await checkConnectivity();
    if (version !== _connectivityCheckVersion) return;

    _pendingOfflineTimer = null;
    if (confirmedOnline) {
      _consecutiveFailures = 0;
    }
    setOnlineState(confirmedOnline);
  }, OFFLINE_CONFIRMATION_DELAY);

  return false;
}

function setOnlineState(online: boolean) {
  if (online) {
    _consecutiveFailures = 0;
  }
  if (online && _pendingOfflineTimer) {
    clearTimeout(_pendingOfflineTimer);
    _pendingOfflineTimer = null;
  }

  const changed = _isActuallyOnline !== online;
  _isActuallyOnline = online;

  // Sync TanStack's onlineManager
  onlineManager.setOnline(online);

  if (changed) {
    _listeners.forEach(fn => fn(online));

    // When coming back online, refetch all failed/error queries
    if (online && _queryClient) {
      _queryClient.refetchQueries({ type: 'all', predicate: (q) => q.state.status === 'error' });
    }

    // Adjust heartbeat frequency
    restartHeartbeat();
  }
}

function restartHeartbeat() {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer);
  const interval = _isActuallyOnline ? HEARTBEAT_INTERVAL : HEARTBEAT_INTERVAL_OFFLINE;
  _heartbeatTimer = setInterval(async () => {
    await runConnectivityCheck();
  }, interval);
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Initialize connectivity monitoring.
 * Call once at app startup (before React mounts ideally).
 */
export function initConnectivityManager(queryClient: QueryClient) {
  _queryClient = queryClient;

  // Override TanStack's default online detection
  onlineManager.setEventListener((setOnline) => {
    const handleOnline = () => {
      // Recover UI immediately when browser regains network, then verify.
      setOnlineState(true);
      setOnline(true);
      void runConnectivityCheck();
    };
    const handleOffline = () => {
      // Browser says offline — trust it immediately
      setOnlineState(false);
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also check on visibility change (tab unfrozen)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void runConnectivityCheck();
      }
    };

    const handleFocus = () => {
      void runConnectivityCheck();
    };

    const handlePageShow = () => {
      void runConnectivityCheck();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
    };
  });

  // Initial connectivity check
  void runConnectivityCheck();

  // Start heartbeat
  restartHeartbeat();

}

/** Subscribe to connectivity changes */
export function onConnectivityChange(listener: (online: boolean) => void): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

/** Get current connectivity state */
export function getIsOnline(): boolean {
  return _isActuallyOnline;
}

/** Force a connectivity check right now */
export async function forceConnectivityCheck(): Promise<boolean> {
  return runConnectivityCheck();
}
