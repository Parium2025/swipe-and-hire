import { supabase } from '@/integrations/supabase/client';

// In-memory cache to avoid re-signing URLs on every mount/navigation
// Key format: `${bucket}/${path}`
const signedUrlCache = new Map<string, { url: string; fetchedAt: number; maxAgeMs: number }>();

// Default max age we keep a signed URL before refreshing (cap to avoid using near-expiry tokens)
const DEFAULT_CACHE_MAX_AGE_MS = 6 * 24 * 60 * 60 * 1000; // 6 dagar


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
  expiresIn: number = 604800, // 7 dagar
  downloadName?: string
): Promise<string | null> => {
  if (!url) return null;

  const ensureCached = (path: string) => {
    const key = `${bucket}/${path}`;
    const now = Date.now();
    const maxAgeMs = Math.max(60_000, Math.min(expiresIn * 1000 - 60_000, DEFAULT_CACHE_MAX_AGE_MS));
    const cached = signedUrlCache.get(key);
    if (cached && now - cached.fetchedAt < cached.maxAgeMs) {
      return cached.url;
    }
    return null;
  };

  const setCache = (path: string, signed: string) => {
    const key = `${bucket}/${path}`;
    const maxAgeMs = Math.max(60_000, Math.min(expiresIn * 1000 - 60_000, DEFAULT_CACHE_MAX_AGE_MS));
    signedUrlCache.set(key, { url: signed, fetchedAt: Date.now(), maxAgeMs });
  };

  // Case 1: Already a Supabase signed URL -> extract path and use cache or refresh
  if (url.includes('/storage/v1/object/sign/')) {
    const existingPath = getStoragePathFromUrl(url);
    if (existingPath) {
      const cached = ensureCached(existingPath);
      if (cached) return cached;
      const refreshed = await createSignedUrl(bucket, existingPath, expiresIn, downloadName);
      if (refreshed) setCache(existingPath, refreshed);
      return refreshed;
    }
    return url; // If we can't parse, just reuse the given URL
  }

  // Case 2: Raw storage path like `folder/id/filename.ext`
  const isLikelyPath = !/^https?:\/\//i.test(url) && !url.startsWith('data:');
  if (isLikelyPath) {
    const cached = ensureCached(url);
    if (cached) return cached;
    const signed = await createSignedUrl(bucket, url, expiresIn, downloadName);
    if (signed) setCache(url, signed);
    return signed;
  }

  // Case 3: Public or other absolute URL -> try extracting a storage path first
  const path = getStoragePathFromUrl(url);
  if (!path) {
    // Not a Supabase storage URL; just return original
    return url;
  }
  const cached = ensureCached(path);
  if (cached) return cached;
  const signed = await createSignedUrl(bucket, path, expiresIn, downloadName);
  if (signed) setCache(path, signed);
  return signed;
};