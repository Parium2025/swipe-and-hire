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

  // Skip if browser can't decode (defensive)
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    return input;
  }

  try {
    const bitmap = await createImageBitmap(input);
    const { width, height } = bitmap;

    // If already small enough AND already webp/jpeg, skip
    const alreadySmall = Math.max(width, height) <= maxDimension;
    const goodFormat = input.type === mimeType;
    if (alreadySmall && goodFormat && input.size < 200 * 1024) {
      bitmap.close();
      return input;
    }

    // Calculate new dimensions preserving aspect ratio
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return input;
    }

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: mimeType, quality });

    // Only return compressed version if it's actually smaller
    return blob.size < input.size ? blob : input;
  } catch (err) {
    // Any failure — return original, never block the upload
    console.warn('[imageUploadOptimization] Compression skipped:', err);
    return input;
  }
}
