/**
 * Service Worker Manager
 * Hanterar registrering och kommunikation med service worker
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
      scope: '/'
    });

    

    // Lyssna på uppdateringar
    registration.addEventListener('updatefound', () => {
      const newWorker = registration?.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            
            // Här kan vi visa en toast till användaren om uppdatering
          }
        });
      }
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
