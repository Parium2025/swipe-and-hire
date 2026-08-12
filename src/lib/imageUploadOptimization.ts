/**
 * Image upload optimization utilities.
 *
 * Goals:
 * 1. Reduce upload size by client-side resizing/compression to WebP.
 * 2. Provide consistent, long cacheControl options for storage uploads.
 *
 * IMPORTANT: This module changes nothing visually. Output dimensions
 * default to 1024px (more than enough for any avatar/logo render at
 * up to 4x DPR for a 256px display). Quality 0.9 = visually lossless.
 */

/**
 * Standard upload options for storage uploads of branding/profile assets.
 * cacheControl is set to 1 year because we always version-bust URLs via
 * `?t=<timestamp>` or appendVersionToUrl(updated_at).
 */
export const LONG_CACHE_UPLOAD_OPTIONS = {
  cacheControl: '31536000', // 1 year in seconds
  upsert: true,
} as const;

interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/jpeg';
}

/**
 * Compress and resize an image Blob/File before upload.
 * Returns the original blob unchanged if anything fails (safe fallback).
 *
 * - Skips compression for SVGs (vector — no benefit).
 * - Skips compression if input is already small enough.
 */
export async function compressImageBlob(
  input: Blob | File,
  options: CompressOptions = {}
): Promise<Blob> {
  const {
    maxDimension = 1024,
    quality = 0.9,
    mimeType = 'image/webp',
  } = options;

  // Don't touch SVGs — they're vector and tiny
  if (input.type === 'image/svg+xml') return input;

  // Snabb utväg: redan liten och i rätt format
  if (
    input.type === mimeType &&
    input.size < 200 * 1024 &&
    typeof createImageBitmap !== 'function'
  ) {
    return input;
  }

  // 1) Modern väg: createImageBitmap + OffscreenCanvas (snabbast, off-main-thread)
  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(input);
      const { width, height } = bitmap;

      const alreadySmall = Math.max(width, height) <= maxDimension;
      if (alreadySmall && input.type === mimeType && input.size < 200 * 1024) {
        bitmap.close();
        return input;
      }

      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));

      const canvas = new OffscreenCanvas(targetW, targetH);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, targetW, targetH);
        bitmap.close();
        const blob = await canvas.convertToBlob({ type: mimeType, quality });
        if (blob.size < input.size) return blob;
        // Om webp blev större (ovanligt): behåll originalet om det är rimligt litet
        if (input.size <= SAFE_UPLOAD_BYTES) return input;
      } else {
        bitmap.close();
      }
    } catch (err) {
      console.warn('[imageUploadOptimization] OffscreenCanvas-väg misslyckades:', err);
    }
  }

  // 2) Fallback: klassisk <canvas> + <img>. Fungerar i äldre Safari/Android-webbläsare
  //    där OffscreenCanvas.convertToBlob saknas. Utan detta kunde ett stort original
  //    laddas upp okomprimerat och bild-CDN:en vägra rendera det.
  try {
    return await compressWithHtmlCanvas(input, maxDimension, quality, mimeType);
  } catch (err) {
    console.warn('[imageUploadOptimization] Compression skipped:', err);
    return input;
  }
}

/** Största filstorlek vi vågar lagra otransformerad (bild-CDN:en nekar stora original). */
export const SAFE_UPLOAD_BYTES = 6 * 1024 * 1024;

function compressWithHtmlCanvas(
  input: Blob | File,
  maxDimension: number,
  quality: number,
  mimeType: 'image/webp' | 'image/jpeg'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') {
      reject(new Error('Ingen canvas tillgänglig'));
      return;
    }
    const objectUrl = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
        const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
        const targetH = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Ingen 2d-kontext');
        ctx.drawImage(img, 0, 0, targetW, targetH);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              reject(new Error('toBlob gav inget resultat'));
              return;
            }
            resolve(blob.size < input.size ? blob : input);
          },
          // Safari <14 saknar webp-encoding → jpeg som sista utväg
          mimeType,
          quality
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Kunde inte avkoda bilden'));
    };
    img.src = objectUrl;
  });
}
