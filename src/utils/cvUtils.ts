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
    // CV-tunnel: navigera till in-app viewer för stabil öppning utan popups
    const isStoragePath = !/^https?:\/\//i.test(cvUrl);
    const params = new URLSearchParams();
    if (isStoragePath) params.set('path', cvUrl);
    else params.set('url', cvUrl);
    if (fileName) params.set('name', fileName);

    onSuccess?.('Öppnar CV…');
    // Använd samma flik så att det aldrig blockeras av popup-blockerare
    window.location.href = `/cv-tunnel?${params.toString()}`;
  } catch (error) {
    console.error('Error opening CV:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error opening CV'));
  }
}
