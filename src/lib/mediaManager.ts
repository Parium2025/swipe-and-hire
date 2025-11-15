import { supabase } from '@/integrations/supabase/client';

/**
 * 🔒 KRITISKT: DETTA ÄR DEN ENDA KÄLLAN TILL SANNING FÖR MEDIA-HANTERING
 * 
 * ⚠️ LÄSA MEDIA_SYSTEM_CRITICAL.md INNAN DU GÖR NÅGRA ÄNDRINGAR! ⚠️
 * 
 * ARKITEKTUR (ÄNDRA ALDRIG):
 * 
 * PRIVATE BUCKETS (kräver signed URLs med behörighetskontroll):
 * - job-applications: Profilbilder, videor, cover-bilder, CV:n, ansökningsdokument
 *   → Jobbsökare ser sina egna filer
 *   → Arbetsgivare ser kandidatfiler när de har permission (via ansökan)
 *   → Super admins ser allt
 * 
 * PUBLIC BUCKETS (direkt åtkomst, ingen signering):
 * - company-logos: Företagslogotyper (publikt tillgängliga)
 * - job-images: Jobbannonsbilder (publikt tillgängliga)
 * 
 * REGLER:
 * 1. ANVÄND ALLTID denna fil för uppladdningar (ingen direkt supabase.storage-anrop)
 * 2. SPARA ENDAST storage paths i databasen (aldrig URLs)
 * 3. ANVÄND useMediaUrl hook för visning (genererar signed URLs automatiskt)
 * 4. ÄNDRA ALDRIG bucket-konfigurationen för kandidatmedia
 * 5. ÄNDRA ALDRIG isPublic för kandidatmedia (måste vara false)
 */

// ========== SIGNED URL CACHE ==========
// Cache för att undvika att generera nya signed URLs hela tiden
interface CachedSignedUrl {
  url: string;
  expiresAt: number;
  createdAt: number;
}

const signedUrlCache = new Map<string, CachedSignedUrl>();

// Rensa utgångna URLs varje 5 minuter
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, cached] of signedUrlCache.entries()) {
      if (now >= cached.expiresAt) {
        signedUrlCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export type MediaType = 
  | 'profile-image'
  | 'profile-video'
  | 'cover-image'
  | 'cv'
  | 'company-logo'
  | 'job-image'
  | 'application-document';

interface MediaConfig {
  bucket: string;
  isPublic: boolean;
  maxSizeMB: number;
  allowedTypes: string[];
}

const MEDIA_CONFIG: Record<MediaType, MediaConfig> = {
  'profile-image': {
    bucket: 'job-applications',
    isPublic: false,
    maxSizeMB: 10,
    allowedTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif'
    ]
  },
  'profile-video': {
    bucket: 'job-applications',
    isPublic: false,
    maxSizeMB: 50,
    allowedTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo']
  },
  'cover-image': {
    bucket: 'job-applications',
    isPublic: false,
    maxSizeMB: 10,
    allowedTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ]
  },
  'cv': {
    bucket: 'job-applications',
    isPublic: false,
    maxSizeMB: 10,
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  },
  'application-document': {
    bucket: 'job-applications',
    isPublic: false,
    maxSizeMB: 10,
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
  },
  'company-logo': {
    bucket: 'company-logos',
    isPublic: true,
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  },
  'job-image': {
    bucket: 'job-images',
    isPublic: true,
    maxSizeMB: 10,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  }
};

/**
 * 🔒 KRITISKT: Ladda upp en fil till rätt bucket baserat på mediatyp
 * 
 * ⚠️ ANVÄND ALLTID DENNA FUNKTION FÖR UPPLADDNINGAR - ALDRIG DIREKT SUPABASE.STORAGE ⚠️
 * 
 * @param file - Filen som ska laddas upp
 * @param mediaType - Typ av media (bestämmer bucket och validering)
 * @param userId - User ID (används för att skapa säker mapstruktur)
 * @returns {{ storagePath: string; error?: Error }} - ENDAST STORAGE PATH (aldrig URL)
 * 
 * VIKTIGT: Returnerar ENDAST storage path (t.ex. "user-id/timestamp.jpg")
 * Spara detta värde direkt i databasen. Använd useMediaUrl för att visa media.
 */
export async function uploadMedia(
  file: File,
  mediaType: MediaType,
  userId: string
): Promise<{ storagePath: string; error?: Error }> {
  const config = MEDIA_CONFIG[mediaType];
  
  // Validera filstorlek
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > config.maxSizeMB) {
    return { 
      storagePath: '', 
      error: new Error(`Filen är för stor. Max ${config.maxSizeMB}MB tillåtet.`) 
    };
  }
  
  // Validera filtyp
  if (!config.allowedTypes.includes(file.type)) {
    return { 
      storagePath: '', 
      error: new Error(`Filtypen ${file.type} är inte tillåten för ${mediaType}.`) 
    };
  }
  
  // Skapa unikt filnamn
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  
  // Ladda upp till rätt bucket
  const { error: uploadError } = await supabase.storage
    .from(config.bucket)
    .upload(fileName, file);
  
  if (uploadError) {
    console.error(`Upload error for ${mediaType}:`, uploadError);
    return { storagePath: '', error: uploadError };
  }
  
  // Returnera ENDAST storage path (aldrig URL)
  return { storagePath: fileName };
}

/**
 * 🔒 KRITISKT: Generera URL för att visa/ladda ner media
 * 
 * ⚠️ ANVÄND useMediaUrl HOOK I KOMPONENTER - ANROPA INTE DIREKT ⚠️
 * 
 * @param storagePath - Storage path från databasen (t.ex. "user-id/timestamp.jpg")
 * @param mediaType - Typ av media (bestämmer bucket)
 * @param expiresInSeconds - Hur länge signed URL ska vara giltig (default 24h)
 * @returns {Promise<string | null>} Signed URL för private media, public URL för public media
 * 
 * FUNKTIONALITET:
 * - Public buckets: Returnerar public URL direkt
 * - Private buckets: Genererar signed URL med expiration
 * - Backward compatibility: Fallback till gamla profile-media bucket
 */
export async function getMediaUrl(
  storagePath: string,
  mediaType: MediaType,
  expiresInSeconds: number = 86400 // 24 timmar default
): Promise<string | null> {
  if (!storagePath) return null;
  
  const config = MEDIA_CONFIG[mediaType];
  
  // Om det redan är en full URL, extrahera storage path först
  let cleanPath = storagePath;
  if (storagePath.startsWith('http')) {
    // If URL points to public profile-media, return as-is (backward compatibility during migration)
    if (storagePath.includes('/storage/v1/object/public/profile-media/')) {
      // Strip query params for stability
      return storagePath.split('?')[0];
    }
    // Extract path from other URL formats
    const match = storagePath.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
    if (match) {
      cleanPath = match[1];
    } else {
      // Cannot extract path, return original
      return storagePath;
    }
  }
  
  // Public bucket → returnera public URL
  if (config.isPublic) {
    const { data } = supabase.storage
      .from(config.bucket)
      .getPublicUrl(cleanPath);
    return data.publicUrl;
  }
  
  // Private bucket → generera signed URL (med cache)
  const cacheKey = `${config.bucket}:${cleanPath}:${expiresInSeconds}`;
  const cached = signedUrlCache.get(cacheKey);
  
  // Om vi har en cachad URL som fortfarande är giltig i minst 1 timme, använd den
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  if (cached && (cached.expiresAt - now) > oneHour) {
    return cached.url;
  }
  
  // Skapa ny signed URL
  const { data, error } = await supabase.storage
    .from(config.bucket)
    .createSignedUrl(cleanPath, expiresInSeconds);
  
  if (error) {
    console.error(`Error creating signed URL for ${mediaType}:`, error);
    // Backwards compatibility: some older profile/cover images may live in public 'profile-media'
    if ((mediaType === 'profile-image' || mediaType === 'cover-image') &&
        (error as any)?.statusCode === '404' || (error as any)?.message?.includes('Object not found')) {
      const { data: pub } = supabase.storage
        .from('profile-media')
        .getPublicUrl(cleanPath);
      return pub?.publicUrl ?? null;
    }
    return null;
  }
  
  // Cacha signed URL
  signedUrlCache.set(cacheKey, {
    url: data.signedUrl,
    expiresAt: now + (expiresInSeconds * 1000),
    createdAt: now
  });
  
  return data.signedUrl;
}

/**
 * Ta bort media från storage
 */
export async function deleteMedia(
  storagePath: string,
  mediaType: MediaType
): Promise<{ success: boolean; error?: Error }> {
  if (!storagePath) return { success: false, error: new Error('No path provided') };
  
  const config = MEDIA_CONFIG[mediaType];
  
  // Om det är en URL, extrahera path
  let cleanPath = storagePath;
  if (storagePath.startsWith('http')) {
    const match = storagePath.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
    if (match) {
      cleanPath = match[1];
    }
  }
  
  const { error } = await supabase.storage
    .from(config.bucket)
    .remove([cleanPath]);
  
  if (error) {
    console.error(`Delete error for ${mediaType}:`, error);
    return { success: false, error };
  }
  
  return { success: true };
}

/**
 * Hjälpfunktion: Detektera mediatyp från fil eller URL
 */
export function detectMediaType(file: File): MediaType | null {
  const type = file.type;
  
  if (type.startsWith('video/')) return 'profile-video';
  if (type.startsWith('image/')) {
    // Kan vara profil, cover eller annat - låt användaren specificera
    return 'profile-image';
  }
  if (type === 'application/pdf' || type.includes('word')) return 'cv';
  
  return null;
}

/**
 * Kontrollera om en bucket är public
 */
export function isBucketPublic(bucket: string): boolean {
  return ['company-logos', 'job-images'].includes(bucket);
}

/**
 * Hämta bucket för en specifik mediatyp
 */
export function getBucketForMediaType(mediaType: MediaType): string {
  return MEDIA_CONFIG[mediaType].bucket;
}
