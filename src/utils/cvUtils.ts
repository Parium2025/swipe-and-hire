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
    // Open popup immediately for better UX
    const popup = window.open('', '_blank');
    
    // Check if cv_url is a storage path or full URL
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
    
    if (popup) {
      popup.location.href = finalUrl;
    } else {
      window.open(finalUrl, '_blank');
    }
    
    onSuccess?.('CV öppnat i ny flik');
  } catch (error) {
    console.error('Error opening CV:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error opening CV'));
  }
}
