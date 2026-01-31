/**
 * Critical Asset Cache (Client)
 *
 * Goal: Make certain “always there” visuals (like the auth logo) render
 * instantly on hard refresh by hydrating a blob: objectURL from CacheStorage
 * BEFORE React mounts.
 *
 * This mirrors the AvatarImage strategy (sync cached check), but instead of
 * relying on `img.complete` we explicitly hydrate from CacheStorage which is
 * persistent across reloads (and already populated by the Service Worker).
 */

const objectUrlByUrl = new Map<string, string>();

async function decodeImage(src: string): Promise<void> {
  if (typeof window === 'undefined') return;

  await new Promise<void>((resolve) => {
    const img = new Image();

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    img.onload = done;
    img.onerror = done;

    // Best-effort hints (safe in all browsers)
    try {
      (img as any).decoding = 'sync';
    } catch {
      // ignore
    }
    try {
      (img as any).fetchPriority = 'high';
    } catch {
      // ignore
    }

    img.src = src;

    // decode() resolves when the image is decoded and ready to paint.
    // Not supported everywhere, so we always keep onload/onerror as fallback.
    try {
      const d = (img as any).decode;
      if (typeof d === 'function') {
        d.call(img).then(done).catch(done);
      }
    } catch {
      // ignore
    }
  });
}

async function hydrateFromCacheStorage(url: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('caches' in window)) return null;

  try {
    // Search all caches (SW caches included) for this request.
    // Be robust: try both relative and absolute forms.
    const absoluteUrl = (() => {
      try {
        return new URL(url, window.location.origin).toString();
      } catch {
        return url;
      }
    })();

    const match =
      (await caches.match(url, { ignoreSearch: true })) ||
      (absoluteUrl !== url ? await caches.match(absoluteUrl, { ignoreSearch: true }) : null);
    if (!match) return null;

    const blob = await match.blob();
    if (!blob || blob.size === 0) return null;

    const objectUrl = URL.createObjectURL(blob);

    // CRITICAL: Pre-decode the blob URL before React mounts.
    // Without this, the first paint can still show a “loading” moment even
    // if the bytes are already cached.
    await decodeImage(objectUrl);

    return objectUrl;
  } catch {
    return null;
  }
}

/**
 * Hydrates critical assets from CacheStorage into in-memory blob URLs.
 * Safe to call multiple times.
 */
export async function hydrateCriticalAssets(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(async (url) => {
      if (!url || objectUrlByUrl.has(url)) return;
      const objectUrl = await hydrateFromCacheStorage(url);
      if (objectUrl) objectUrlByUrl.set(url, objectUrl);
    })
  );
}

/**
 * Returns a blob: URL if we already hydrated it, otherwise returns the original URL.
 */
export function getCriticalAssetSrc(url: string): string {
  return objectUrlByUrl.get(url) ?? url;
}
