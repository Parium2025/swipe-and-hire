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

// ─── Heartbeat ping ──────────────────────────────────────────────

const HEARTBEAT_INTERVAL = 30_000; // 30s when online
const HEARTBEAT_INTERVAL_OFFLINE = 5_000; // 5s when offline (check more frequently)
const PING_TIMEOUT = 5_000;

/**
 * Lightweight connectivity check.
 * Uses a HEAD request to the app's own origin (no CORS issues, tiny payload).
 * Falls back to navigator.onLine if the request errors in an ambiguous way.
 */
async function checkConnectivity(): Promise<boolean> {
  // If browser says offline, trust it immediately
  if (!navigator.onLine) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT);

    // Ping our own origin with cache-busting to avoid SW/CDN caches
    const response = await fetch(`${window.location.origin}/favicon.ico?_cb=${Date.now()}`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    // no-cors responses have type 'opaque' with status 0, which is fine — it means we reached the server
    return response.type === 'opaque' || response.ok;
  } catch (err: any) {
    // AbortError = timeout = likely offline
    if (err?.name === 'AbortError') return false;
    // TypeError usually means network failure
    if (err instanceof TypeError) return false;
    // Other errors are ambiguous, trust navigator.onLine
    return navigator.onLine;
  }
}

function setOnlineState(online: boolean) {
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
    const online = await checkConnectivity();
    setOnlineState(online);
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
      // Don't trust the event blindly — verify with a ping
      checkConnectivity().then(setOnlineState);
    };
    const handleOffline = () => {
      // Browser says offline — trust it immediately
      setOnlineState(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also check on visibility change (tab unfrozen)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkConnectivity().then(setOnlineState);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  });

  // Initial connectivity check
  checkConnectivity().then(setOnlineState);

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
  const online = await checkConnectivity();
  setOnlineState(online);
  return online;
}
