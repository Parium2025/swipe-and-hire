/**
 * Service Worker Manager (disabled)
 *
 * Parium ska inte längre registrera en Service Worker. Safari har fastnat på
 * gamla landing-bundles via tidigare SW-cache, så den här modulen finns kvar
 * endast som bakåtkompatibla no-op/native helpers för befintliga imports.
 */

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
  return null;
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
        .filter((key) => key.startsWith('parium-') || key.includes('parium'))
        .map((key) => caches.delete(key).catch(() => false))
    );
  } catch {
    // ignore — cache cleanup must never block the app
  }
};

export const isServiceWorkerActive = (): boolean => false;

export const waitForServiceWorker = async (): Promise<void> => undefined;
