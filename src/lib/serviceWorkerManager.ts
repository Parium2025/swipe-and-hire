/**
 * Service Worker Manager
 * Hanterar registrering och kommunikation med service worker
 */

let registration: ServiceWorkerRegistration | null = null;

/**
 * Version poll: jämför hashade asset-länkar i /index.html mot vad som körs nu.
 * Detta gör att även deploys utan sw.js-ändring (nya hashade JS/CSS) upptäcks
 * och triggar en automatisk reload — även på vanliga webben, där SW annars
 * inte ger någon "controllerchange" eftersom sw.js är oförändrad.
 */
let cachedEntrySignature: string | null = null;
let versionPollStarted = false;
let versionReloadTriggered = false;

const computeCurrentEntrySignature = (): string | null => {
  try {
    // Samla alla hashade bundle-länkar som faktiskt körs/rendrats av Vite
    const scripts = Array.from(document.querySelectorAll('script[src]'))
      .map((s) => (s as HTMLScriptElement).src)
      .filter((src) => /\/assets\/.+\.(js|mjs)$/.test(src));
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
      .map((l) => (l as HTMLLinkElement).href)
      .filter((href) => /\/assets\/.+\.css$/.test(href));
    const all = [...scripts, ...styles].sort();
    return all.length > 0 ? all.join('|') : null;
  } catch {
    return null;
  }
};

const extractEntrySignatureFromHtml = (html: string): string | null => {
  try {
    const matches: string[] = [];
    const scriptRe = /<script[^>]+src=["']([^"']*\/assets\/[^"']+\.(?:js|mjs))["']/gi;
    const linkRe = /<link[^>]+href=["']([^"']*\/assets\/[^"']+\.css)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = scriptRe.exec(html)) !== null) matches.push(new URL(m[1], window.location.origin).href);
    while ((m = linkRe.exec(html)) !== null) matches.push(new URL(m[1], window.location.origin).href);
    matches.sort();
    return matches.length > 0 ? matches.join('|') : null;
  } catch {
    return null;
  }
};

const checkForNewVersion = async (): Promise<void> => {
  if (versionReloadTriggered) return;
  try {
    const res = await fetch('/index.html', {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'cache-control': 'no-cache' },
    });
    if (!res.ok) return;
    const html = await res.text();
    const remoteSig = extractEntrySignatureFromHtml(html);
    if (!remoteSig) return;
    if (!cachedEntrySignature) {
      cachedEntrySignature = computeCurrentEntrySignature() || remoteSig;
      return;
    }
    if (remoteSig !== cachedEntrySignature) {
      versionReloadTriggered = true;
      console.log('[SW] New app version detected — reloading');
      // Liten delay så vi inte avbryter pågående interaktion mitt i ett klick
      setTimeout(() => {
        try { window.location.reload(); } catch { /* ignore */ }
      }, 300);
    }
  } catch {
    // ignore — offline eller transient fel
  }
};

const startVersionPolling = () => {
  if (versionPollStarted) return;
  versionPollStarted = true;

  // Initial baseline från det som faktiskt körs i sidan
  cachedEntrySignature = computeCurrentEntrySignature();

  // Kontrollera direkt om servern redan har en nyare deploy än den som körs lokalt
  void checkForNewVersion();

  // Poll var 60:e sekund
  setInterval(() => { void checkForNewVersion(); }, 60_000);

  // Vid tab-focus och online → snabb check
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForNewVersion();
  });
  window.addEventListener('online', () => { void checkForNewVersion(); });
  window.addEventListener('focus', () => { void checkForNewVersion(); });
};

/**
 * Registrera service worker
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  // Starta versionspoll oavsett om SW finns/lyckas — fungerar även utan SW.
  startVersionPolling();

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

    // When a new SW takes control, hard-reload to ensure fresh UI/assets
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    });

    // If there is already a waiting worker (rare but possible), activate it immediately
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Lyssna på uppdateringar
    registration.addEventListener('updatefound', () => {
      const newWorker = registration?.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Activate update immediately (controllerchange will reload)
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });

    // Periodisk update-check var 30:e sekund
    setInterval(() => {
      registration?.update().catch(() => {});
    }, 30_000);

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
    
    // Add timeout to prevent hanging forever
    const timeout = setTimeout(() => {
      console.warn('Service Worker message timeout, continuing anyway');
      resolve(); // Resolve instead of reject to not block UI
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
    const validUrls = urls.filter(url => url && url.trim() !== '');
    if (validUrls.length === 0) return;

    
    
    await sendMessage({
      type: 'PRELOAD_IMAGES',
      urls: validUrls
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
      urls: [url]
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
      type: 'CLEAR_IMAGE_CACHE'
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
 * Vänta på att service worker blir aktiv
 */
export const waitForServiceWorker = (): Promise<void> => {
  return new Promise((resolve) => {
    if (isServiceWorkerActive()) {
      resolve();
      return;
    }

    const checkActive = () => {
      if (isServiceWorkerActive()) {
        resolve();
      } else {
        setTimeout(checkActive, 100);
      }
    };

    checkActive();
  });
};
