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
    const isStoragePath = !/^https?:\/\//i.test(cvUrl);

    // Prepare a signed URL
    let finalUrl = cvUrl;
    if (isStoragePath) {
      finalUrl = (await createSignedUrl('job-applications', cvUrl, 86400, fileName)) || cvUrl;
    } else {
      finalUrl = (await convertToSignedUrl(cvUrl, 'job-applications', 86400, fileName)) || cvUrl;
    }

    // Always open in new tab - browser will render PDF natively
    const win = window.open(finalUrl, '_blank', 'noopener,noreferrer');
    if (win) {
      onSuccess?.('CV öppnas i ny flik');
    } else {
      // Popup blocked - try direct navigation as fallback
      window.location.href = finalUrl;
      onSuccess?.('Öppnar CV…');
    }
  } catch (error) {
    console.error('Error opening CV:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error opening CV'));
  }
}
