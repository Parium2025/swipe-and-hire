/** Narrow app-shell Service Worker lifecycle helpers. */

import {
  SERVICE_WORKER_ACTIVATION_PROBE,
  SERVICE_WORKER_ACTIVATION_READY,
  SERVICE_WORKER_ACTIVATION_RESULT,
  SERVICE_WORKER_BUILD_ACK,
  SERVICE_WORKER_BUILD_HANDSHAKE,
  SERVICE_WORKER_BUILD_PROTOCOL,
} from './serviceWorkerPolicy';

let buildHandshakeInstalled = false;

/** Lets a new worker distinguish current clients from destructive legacy tabs. */
export const installServiceWorkerBuildHandshake = (): void => {
  if (buildHandshakeInstalled) return;
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.addEventListener) return;

  try {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if (
        event.data?.type !== SERVICE_WORKER_BUILD_HANDSHAKE
        || event.data?.protocol !== SERVICE_WORKER_BUILD_PROTOCOL
      ) return;

      event.ports?.[0]?.postMessage({
        type: SERVICE_WORKER_BUILD_ACK,
        protocol: SERVICE_WORKER_BUILD_PROTOCOL,
      });
    });
    buildHandshakeInstalled = true;
  } catch {
    // Service-worker messaging is unavailable in some restricted private modes.
  }
};

const preloadNative = (url: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!url || typeof Image === 'undefined') {
      resolve();
      return;
    }

    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
};

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  try {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.register) return null;
    return await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  } catch {
    // Offline/private-mode restrictions must never block React bootstrap.
    return null;
  }
};

const HOME_UPDATE_RELOAD_MARKER = 'parium_home_sw_update_reload_at';
const HOME_UPDATE_RELOAD_TTL_MS = 60_000;

const hasRecentHomeUpdateReload = (): boolean => {
  try {
    const value = sessionStorage.getItem(HOME_UPDATE_RELOAD_MARKER);
    if (!value) return false;
    const timestamp = Number(value);
    if (Number.isFinite(timestamp) && Date.now() - timestamp < HOME_UPDATE_RELOAD_TTL_MS) {
      return true;
    }
    sessionStorage.removeItem(HOME_UPDATE_RELOAD_MARKER);
  } catch {
    // Some private modes restrict storage. Worker state still prevents loops.
  }
  return false;
};

const markHomeUpdateReload = (): void => {
  try {
    sessionStorage.setItem(HOME_UPDATE_RELOAD_MARKER, String(Date.now()));
  } catch {
    // Best effort; a successfully activated worker no longer remains waiting.
  }
};

const clearHomeUpdateReloadMark = (): void => {
  try {
    sessionStorage.removeItem(HOME_UPDATE_RELOAD_MARKER);
  } catch {
    // noop
  }
};

const HOME_RETRY_LIMIT = 2;
const HOME_RETRY_MIN_INTERVAL_MS = 60_000;

/**
 * Retries a deferred/aborted shell registration without polling. A frozen or
 * legacy tab can therefore postpone activation without ever being reloaded.
 */
export const installLimitedHomeServiceWorkerRetry = (
  retry: () => boolean,
): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;

  let attempts = 0;
  let lastAttemptAt = Date.now();
  const onRetrySignal = () => {
    const now = Date.now();
    if (
      attempts >= HOME_RETRY_LIMIT
      || now - lastAttemptAt < HOME_RETRY_MIN_INTERVAL_MS
    ) return;

    if (!retry()) return;
    attempts += 1;
    lastAttemptAt = now;
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') onRetrySignal();
  };

  window.addEventListener('focus', onRetrySignal);
  window.addEventListener('online', onRetrySignal);
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    window.removeEventListener('focus', onRetrySignal);
    window.removeEventListener('online', onRetrySignal);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
};

export const preloadImages = async (urls: string[]): Promise<void> => {
  const validUrls = urls.filter((url) => typeof url === 'string' && url.trim() !== '');
  if (validUrls.length === 0) return;

  await Promise.allSettled(validUrls.map(preloadNative));
};

export const preloadSingleFile = async (url: string): Promise<void> => {
  if (!url || url.trim() === '') return;
  await preloadNative(url);
};

export const clearImageCache = async (): Promise<void> => {
  try {
    if (typeof caches === 'undefined' || !caches.keys) return;
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('parium-image'))
        .map((key) => caches.delete(key).catch(() => false))
    );
  } catch {
    // ignore — cache cleanup must never block the app
  }
};

export const isServiceWorkerActive = (): boolean => {
  try {
    return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
  } catch {
    return false;
  }
};

export const waitForServiceWorker = async (): Promise<void> => {
  try {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.ready) return;
    await navigator.serviceWorker.ready;
  } catch {
    // best effort
  }
};

const waitForInstalledUpdate = async (
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorker | null> => {
  if (registration.waiting) return registration.waiting;
  const worker = registration.installing;
  if (!worker) return null;
  if (worker.state === 'installed') return registration.waiting ?? worker;
  if (worker.state === 'redundant') return null;

  return await new Promise<ServiceWorker | null>((resolve) => {
    let settled = false;
    const finish = (value: ServiceWorker | null) => {
      if (settled) return;
      settled = true;
      worker.removeEventListener('statechange', onStateChange);
      resolve(value);
    };
    const onStateChange = () => {
      if (worker.state === 'installed') finish(registration.waiting ?? worker);
      if (worker.state === 'redundant') finish(null);
    };
    worker.addEventListener('statechange', onStateChange);
    onStateChange();
  });
};

// This probe has no activation side effect, so favor availability for
// throttled/background tabs over a short fail-fast timeout. Legacy workers
// still settle safely without ever receiving SKIP_WAITING.
const ACTIVATION_PROBE_TIMEOUT_MS = 10_000;
const ACTIVATION_COMMIT_TIMEOUT_MS = 5_000;
const ACTIVATION_TOTAL_TIMEOUT_MS = ACTIVATION_PROBE_TIMEOUT_MS + ACTIVATION_COMMIT_TIMEOUT_MS;

const supportsSafeActivationProtocol = async (
  worker: ServiceWorker,
): Promise<boolean> => await new Promise<boolean>((resolve) => {
  if (typeof MessageChannel === 'undefined') {
    resolve(false);
    return;
  }

  const channel = new MessageChannel();
  let settled = false;
  const finish = (supported: boolean) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    channel.port1.close();
    resolve(supported);
  };
  const timeoutId = setTimeout(
    () => finish(false),
    ACTIVATION_PROBE_TIMEOUT_MS,
  );
  channel.port1.onmessage = (event: MessageEvent) => {
    finish(
      event.data?.type === SERVICE_WORKER_ACTIVATION_READY
      && event.data?.protocol === SERVICE_WORKER_BUILD_PROTOCOL,
    );
  };
  channel.port1.onmessageerror = () => finish(false);

  try {
    worker.postMessage({
      type: SERVICE_WORKER_ACTIVATION_PROBE,
      protocol: SERVICE_WORKER_BUILD_PROTOCOL,
    }, [channel.port2]);
  } catch {
    finish(false);
  }
});

const requestSafeWorkerActivation = async (
  worker: ServiceWorker,
): Promise<boolean> => {
  if (!await supportsSafeActivationProtocol(worker)) return false;

  return await new Promise<boolean>((resolve) => {
  if (typeof MessageChannel === 'undefined') {
    resolve(false);
    return;
  }

  const channel = new MessageChannel();
  let settled = false;
  const finish = (accepted: boolean) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    channel.port1.close();
    resolve(accepted);
  };
  const timeoutId = setTimeout(
    () => finish(false),
    ACTIVATION_COMMIT_TIMEOUT_MS,
  );
  channel.port1.onmessage = (event: MessageEvent) => {
    finish(
      event.data?.type === SERVICE_WORKER_ACTIVATION_RESULT
      && event.data?.protocol === SERVICE_WORKER_BUILD_PROTOCOL
      && event.data?.accepted === true,
    );
  };
  channel.port1.onmessageerror = () => finish(false);

  try {
    worker.postMessage({
      type: 'SKIP_WAITING',
      protocol: SERVICE_WORKER_BUILD_PROTOCOL,
    }, [channel.port2]);
  } catch {
    finish(false);
  }
  });
};

const activateInstalledWorker = async (worker: ServiceWorker): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.addEventListener) {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    let settled = false;
    let activationAccepted = false;
    let controllerChanged = false;
    const onControllerChange = () => {
      controllerChanged = true;
      if (activationAccepted) finish(true);
    };
    const onWorkerStateChange = () => {
      if (activationAccepted && worker.state === 'activated') finish(true);
      if (worker.state === 'redundant') finish(false);
    };
    const finish = (activated: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (typeof navigator.serviceWorker.removeEventListener === 'function') {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
      if (typeof worker.removeEventListener === 'function') {
        worker.removeEventListener('statechange', onWorkerStateChange);
      }
      resolve(activated);
    };
    const timeoutId = setTimeout(
      () => finish(false),
      ACTIVATION_TOTAL_TIMEOUT_MS,
    );
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
      { once: true },
    );
    if (typeof worker.addEventListener === 'function') {
      worker.addEventListener('statechange', onWorkerStateChange);
    }
    onWorkerStateChange();
    if (settled) return;
    void requestSafeWorkerActivation(worker).then((accepted) => {
      if (!accepted) {
        finish(false);
        return;
      }
      activationAccepted = true;
      if (controllerChanged) {
        finish(true);
        return;
      }
      onWorkerStateChange();
    }).catch(() => {
      finish(false);
    });
  });
};

/**
 * Home-only migration path for an already-controlled legacy session.
 * First installs never reload. A slow update remains observed until it is
 * installed, then one controller change is allowed per short session window.
 */
export const registerServiceWorkerForHome = async (): Promise<boolean> => {
  try {
    const hadController = typeof navigator !== 'undefined'
      && Boolean(navigator.serviceWorker?.controller);
    const registration = await registerServiceWorker();
    if (!registration || !hadController || hasRecentHomeUpdateReload()) return false;

    try {
      await registration.update();
    } catch {
      // An already waiting worker can still be activated while temporarily offline.
    }

    const waiting = await waitForInstalledUpdate(registration);
    if (!waiting || hasRecentHomeUpdateReload()) return false;

    markHomeUpdateReload();
    const activated = await activateInstalledWorker(waiting);
    if (!activated) clearHomeUpdateReloadMark();
    return activated;
  } catch {
    return false;
  }
};

/**
 * Activate an already-installed update immediately before a controlled reload.
 * It is deliberately never called while the current UI keeps running, which
 * prevents old and new hashed chunks from being mixed in one page lifetime.
 */
export const activateWaitingServiceWorker = async (): Promise<void> => {
  try {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.getRegistration) return;
    const registration = await navigator.serviceWorker.getRegistration('/');
    try { await registration?.update(); } catch { /* offline */ }
    const waiting = registration
      ? await waitForInstalledUpdate(registration)
      : null;
    if (!waiting) return;

    await activateInstalledWorker(waiting);
  } catch {
    // Reload still proceeds; the update can activate when all clients close.
  }
};
