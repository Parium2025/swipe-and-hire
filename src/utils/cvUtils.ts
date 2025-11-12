import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';

interface OpenCvOptions {
  cvUrl: string;
  onSuccess?: (message?: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Centralized utility to open CV files from storage
 * Handles both storage paths and full URLs, generates signed URLs for private buckets
 */
export async function openCvFile({ cvUrl, onSuccess, onError }: OpenCvOptions): Promise<void> {
  if (!cvUrl) {
    const error = new Error('No CV URL provided');
    onError?.(error);
    return;
  }

  try {
    // Prepare a popup immediately to avoid blockers
    const popup = window.open('', '_blank');

    // Determine URL type
    const isStoragePath = !cvUrl.startsWith('http');
    const isPrivateBucket = cvUrl.includes('/job-applications/') || isStoragePath;

    let finalUrl = cvUrl;

    // Generate signed URL for private buckets
    if (isStoragePath || isPrivateBucket) {
      if (isStoragePath) {
        finalUrl = await createSignedUrl('job-applications', cvUrl, 86400) || cvUrl;
      } else {
        finalUrl = await convertToSignedUrl(cvUrl, 'job-applications', 86400) || cvUrl;
      }
    }

    // Fetch the file and open via blob URL to avoid extension blocks
    const res = await fetch(finalUrl);
    if (!res.ok) throw new Error(`Kunde inte hämta filen (${res.status})`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    // Try to persist in cache for offline reuse
    try {
      if ('caches' in window) {
        const cache = await caches.open('parium-images-v1');
        const headers = new Headers({ 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream' });
        await cache.put(finalUrl, new Response(blob.slice(0, blob.size), { headers }));
      }
    } catch (e) {
      // Non-fatal
      console.debug('Cache store skipped:', e);
    }

    if (popup) popup.location.href = blobUrl;
    else window.open(blobUrl, '_blank');

    onSuccess?.('CV öppnat i ny flik');
  } catch (error) {
    console.error('Error opening CV:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error opening CV'));
  }
}
