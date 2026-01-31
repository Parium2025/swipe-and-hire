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

async function hydrateFromCacheStorage(url: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('caches' in window)) return null;

  try {
    // Search all caches (SW caches included) for this request.
    const match = await caches.match(url, { ignoreSearch: true });
    if (!match) return null;

    const blob = await match.blob();
    if (!blob || blob.size === 0) return null;

    return URL.createObjectURL(blob);
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
