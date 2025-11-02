import { supabase } from '@/integrations/supabase/client';

/**
 * Creates a signed URL for accessing files in private storage buckets
 * This replaces public URLs to ensure proper access control
 */
export const createSignedUrl = async (
  bucket: string, 
  path: string, 
  expiresIn: number = 3600, // 1 hour default
  downloadName?: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn, downloadName ? { download: downloadName } : undefined);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
};

/**
 * Extracts the storage path from a URL (public or signed)
 */
export const getStoragePathFromUrl = (url: string): string | null => {
  try {
    // Handle public URLs
    if (url.includes('/storage/v1/object/public/')) {
      const parts = url.split('/storage/v1/object/public/');
      if (parts.length > 1) {
        const pathParts = parts[1].split('/');
        if (pathParts.length > 1) {
          // Remove bucket name and return path
          pathParts.shift();
          return pathParts.join('/').split('?')[0]; // Remove query params
        }
      }
    }
    
    // Handle signed URLs
    if (url.includes('/storage/v1/object/sign/')) {
      const parts = url.split('/storage/v1/object/sign/');
      if (parts.length > 1) {
        const pathParts = parts[1].split('/');
        if (pathParts.length > 1) {
          // Remove bucket name and return path
          pathParts.shift();
          return pathParts.join('/').split('?')[0]; // Remove query params
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting storage path:', error);
    return null;
  }
};

/**
 * Converts old public URLs to secure signed URLs
 * This is needed after making storage bucket private
 */
export const convertToSignedUrl = async (
  url: string,
  bucket: string = 'job-applications',
  expiresIn: number = 86400, // 24 hours default
  downloadName?: string
): Promise<string | null> => {
  if (!url) return null;
  
  // If it's already a signed URL, try to re-sign it to refresh expiration
  if (url.includes('/storage/v1/object/sign/')) {
    const existingPath = getStoragePathFromUrl(url);
    if (existingPath) {
      const refreshed = await createSignedUrl(bucket, existingPath, expiresIn, downloadName);
      return refreshed;
    }
    // Fallback: return original if we couldn't parse
    return url;
  }
  
  // Extract the path from the public URL
  const path = getStoragePathFromUrl(url);
  if (!path) {
    console.warn('Could not extract path from URL:', url);
    return null;
  }
  
  // Create a new signed URL
  return await createSignedUrl(bucket, path, expiresIn, downloadName);
};