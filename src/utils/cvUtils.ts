import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';

interface OpenCvOptions {
  cvUrl: string;
  fileName?: string;
  onSuccess?: (message?: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Centralized utility to open CV files from storage
 * Robust against blockers: tries new tab with blob URL, then falls back to auto-download
 */
export async function openCvFile({ cvUrl, fileName = 'cv.pdf', onSuccess, onError }: OpenCvOptions): Promise<void> {
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
        finalUrl = (await createSignedUrl('job-applications', cvUrl, 86400)) || cvUrl;
      } else {
        finalUrl = (await convertToSignedUrl(cvUrl, 'job-applications', 86400)) || cvUrl;
      }
    }

    // Fetch the file and open via blob URL to avoid extension blocks
    let blob: Blob | null = null;
    try {
      const res = await fetch(finalUrl);
      if (!res.ok) throw new Error(`Kunde inte hämta filen (${res.status})`);
      blob = await res.blob();
    } catch (fetchErr) {
      // Offline or blocked – try cache fallback
      try {
        if ('caches' in window) {
          const cache = await caches.open('parium-images-v1');
          const cached = await cache.match(finalUrl);
          if (cached) blob = await cached.blob();
        }
      } catch {}
      if (!blob) throw fetchErr;
    }
    const blobUrl = URL.createObjectURL(blob);

    // Try to persist in cache for offline reuse
    try {
      if ('caches' in window && blob) {
        const cache = await caches.open('parium-images-v1');
        const headers = new Headers({ 'Content-Type': blob.type || 'application/octet-stream' });
        await cache.put(finalUrl, new Response(blob, { headers }));
      }
    } catch (e) {
      // Non-fatal
      console.debug('Cache store skipped:', e);
    }

    let opened = false;
    if (popup) {
      try {
        popup.location.href = blobUrl;
        opened = true;
      } catch {
        opened = false;
      }
    }

    // Fallback: force download via hidden anchor if popup/new tab is blocked
    if (!opened) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    onSuccess?.('CV öppnat (eller nedladdat om fliken blockerades)');
  } catch (error) {
    console.error('Error opening CV:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error opening CV'));
  }
}

