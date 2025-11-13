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
    const isEmbedded = window.self !== window.top; // inside editor/iframe (incognito often blocks iframe PDF)
    const isStoragePath = !/^https?:\/\//i.test(cvUrl);

    // Prepare a signed URL up-front so we can open directly on user gesture when embedded
    let finalUrl = cvUrl;
    if (isStoragePath) {
      finalUrl = (await createSignedUrl('job-applications', cvUrl, 86400, fileName)) || cvUrl;
    } else {
      finalUrl = (await convertToSignedUrl(cvUrl, 'job-applications', 86400, fileName)) || cvUrl;
    }

    if (isEmbedded) {
      // Open in a new tab immediately from the click gesture to avoid Chrome/incognito iframe blocks
      const popup = window.open('', '_blank', 'noopener,noreferrer');
      if (popup) {
        popup.location.href = finalUrl;
        onSuccess?.('CV öppnas i ny flik');
      } else {
        // Fallback: navigate this tab
        window.location.href = finalUrl;
        onSuccess?.('Öppnar CV…');
      }
      return;
    }

    // Otherwise use in-app viewer (CV-tunnel)
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
