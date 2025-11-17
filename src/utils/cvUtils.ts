import { createSignedUrl, convertToSignedUrl, getStoragePathFromUrl } from '@/utils/storageUtils';

interface OpenCvOptions {
  cvUrl: string;
  fileName?: string;
  onSuccess?: (message?: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Öppna CV-filer robust:
 * - Signerade länkar för privata buckets
 * - Tvingar rätt MIME-typ (application/pdf) för inbäddad visning
 * - Stabil cache-nyckel (baserad på storage path) för offline-åtkomst
 * - Direkt öppning i ny flik för både mobile och desktop
 * - Enhanced error handling för 4xx-fel och icke-PDF-filer
 */
export async function openCvFile({ cvUrl, fileName = 'cv.pdf', onSuccess, onError }: OpenCvOptions): Promise<void> {
  if (!cvUrl) {
    const error = new Error('No CV URL provided');
    onError?.(error);
    return;
  }

  try {
    const isEmbedded = window.self !== window.top; // inside editor/iframe (Lovable preview is sandboxed and blocks popups)
    const isStoragePath = !/^https?:\/\//i.test(cvUrl);

    // If we're inside an embedded/sandboxed iframe, avoid popups entirely.
    // Route to in-app viewer (CvTunnel) which resolves signed URL and renders inline.
    if (isEmbedded) {
      const params = new URLSearchParams();
      if (isStoragePath) params.set('path', cvUrl);
      else params.set('url', cvUrl);
      if (fileName) params.set('name', fileName);
      onSuccess?.('Öppnar CV…');
      window.location.href = `/cv-tunnel?${params.toString()}`;
      return;
    }

    // Non-embedded environments: open a real browser tab immediately on user gesture
    // (prevents popup blocking), then resolve the signed URL and navigate that tab.
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (popup) {
      try {
        popup.document.write('<!doctype html><title>Öppnar PDF…</title><body style="margin:0;background:#121212;color:#fff;font:14px system-ui;display:grid;place-items:center;height:100vh">Öppnar PDF…</body>');
        popup.document.close();
      } catch {}
    }

    // Prepare a signed URL
    let finalUrl = cvUrl;
    if (isStoragePath) {
      finalUrl = (await createSignedUrl('job-applications', cvUrl, 86400, fileName)) || cvUrl;
    } else {
      finalUrl = (await convertToSignedUrl(cvUrl, 'job-applications', 86400, fileName)) || cvUrl;
    }

    if (popup) {
      popup.location.href = finalUrl;
      onSuccess?.('CV öppnas i ny flik');
      return;
    }

    // Fallback: if popup was blocked, use in-app viewer in the current tab
    const params = new URLSearchParams();
    if (isStoragePath) params.set('path', cvUrl);
    else params.set('url', cvUrl);
    if (fileName) params.set('name', fileName);

    onSuccess?.('Öppnar CV…');
    window.location.href = `/cv-tunnel?${params.toString()}`;
  } catch (error) {
    console.error('Error opening CV:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error opening CV'));
  }
}
