/**
 * Service Worker Manager
 *
 * Ansvar:
 *  - Registrera SW för offline + bildcache
 *  - Auto-aktivera nya SW-versioner (skipWaiting) utan att själv reloada sidan
 *
 * OBS: Versionsdetektering / reload vid ny deploy hanteras av
 * boot-skriptet i index.html (asset-signatur från Vite-hashar).
 * Det är vår enda "source of truth" för uppdateringar — så vi får
 * inga dubbla reloads eller race conditions.
 */
let registration: ServiceWorkerRegistration | null = null;

/**
 * Registrera service worker
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    // Force check for updates on load
    registration.update().catch(() => {});

    // Aktivera ev. waiting-worker direkt så nya assets serveras snabbt.
    // Vi reloadar INTE här — index.html-skriptet sköter reload baserat
    // på asset-signaturen om bundle faktiskt ändrats.
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    registration.addEventListener('updatefound', () => {
      const newWorker = registration?.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });

    // Periodisk update-check var 60:e sekund
    setInterval(() => {
      registration?.update().catch(() => {});
    }, 60_000);

    // Check vid tab-fokus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration?.update().catch(() => {});
      }
    });

    // Check vid återansluten
    window.addEventListener('online', () => {
      registration?.update().catch(() => {});
    });

    return registration;
  } catch (error) {
    console.error('Failed to register service worker:', error);
    return null;
  }
};

/**
 * Skicka meddelande till service worker
 */
const sendMessage = (message: any, timeoutMs: number = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('No service worker controller'));
      return;
    }

    const messageChannel = new MessageChannel();

    const timeout = setTimeout(() => {
      console.warn('Service Worker message timeout, continuing anyway');
      resolve();
    }, timeoutMs);

    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data);
      }
    };

    navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
  });
};

/**
 * Förladdda bilder via service worker
 */
export const preloadImages = async (urls: string[]): Promise<void> => {
  if (!navigator.serviceWorker.controller) {
    console.warn('Service Worker not ready, skipping preload');
    return;
  }

  try {
    const validUrls = urls.filter((url) => url && url.trim() !== '');
    if (validUrls.length === 0) return;

    await sendMessage({
      type: 'PRELOAD_IMAGES',
      urls: validUrls,
    });
  } catch (error) {
    console.error('Failed to preload images:', error);
  }
};

/**
 * Förladdda en enskild fil direkt efter uppladdning
 */
export const preloadSingleFile = async (url: string): Promise<void> => {
  if (!navigator.serviceWorker.controller) {
    console.warn('Service Worker not ready, skipping single file preload');
    return;
  }

  if (!url || url.trim() === '') return;

  try {
    await sendMessage({
      type: 'PRELOAD_IMAGES',
      urls: [url],
    });
  } catch (error) {
    console.error('Failed to preload file:', error);
  }
};

/**
 * Rensa image cache
 */
export const clearImageCache = async (): Promise<void> => {
  if (!navigator.serviceWorker.controller) {
    console.warn('Service Worker not ready');
    return;
  }

  try {
    await sendMessage({
      type: 'CLEAR_IMAGE_CACHE',
    });
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
};

/**
 * Kontrollera om service worker är aktiv
 */
export const isServiceWorkerActive = (): boolean => {
  return !!(navigator.serviceWorker && navigator.serviceWorker.controller);
};

/**
 * Vänta på att service worker blir aktiv (med timeout för att undvika hängande pollers)
 */
export const waitForServiceWorker = (timeoutMs: number = 5000): Promise<void> => {
  return new Promise((resolve) => {
    if (isServiceWorkerActive()) {
      resolve();
      return;
    }

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    const deadline = Date.now() + timeoutMs;
    const checkActive = () => {
      if (resolved) return;
      if (isServiceWorkerActive()) {
        finish();
        return;
      }
      if (Date.now() >= deadline) {
        // Ge upp tyst — preloading är inte kritiskt
        finish();
        return;
      }
      setTimeout(checkActive, 100);
    };

    checkActive();
  });
};

