/**
 * Persistent bildcache som sparar små bilder som data-URL i localStorage
 * Nyckeln är användarens storagePath (stabilt), värdet är en data-URL.
 * OBS: Avsiktligt begränsad storlek för att undvika överfull localStorage.
 */
const MAX_STORE_BYTES = 2_000_000; // ~2MB per post
const PREFIX = 'media:dataurl:';

function toKey(storagePath: string) {
  return `${PREFIX}${storagePath}`;
}

export function getImmediateDataUrl(storagePath: string | null | undefined): string | null {
  try {
    if (!storagePath) return null;
    const v = localStorage.getItem(toKey(storagePath));
    return v || null;
  } catch {
    return null;
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read failed'));
    reader.onerror = () => reject(reader.error || new Error('read error'));
    reader.readAsDataURL(blob);
  });
}

export async function upsertDataUrl(storagePath: string, blob: Blob) {
  try {
    const dataUrl = await blobToDataUrl(blob);
    // Begränsa storlek
    if (dataUrl.length > MAX_STORE_BYTES) return; // hoppa över stora filer
    localStorage.setItem(toKey(storagePath), dataUrl);
  } catch {
    // ignorera
  }
}

export function removeDataUrl(storagePath: string) {
  try { localStorage.removeItem(toKey(storagePath)); } catch {}
}
