import { supabase } from '@/integrations/supabase/client';

/**
 * Centraliserad media-hantering med konsistent bucket-strategi
 * 
 * PUBLIC BUCKETS (direkt åtkomst, ingen signering):
 * - profile-media: Profilbilder, videor, cover-bilder
 * - company-logos: Företagslogotyper  
 * - job-images: Jobbannonsbilder
 * 
 * PRIVATE BUCKETS (kräver signed URLs):
 * - job-applications: CV:n, ansökningsdokument
 */

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
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
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
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
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
 * Ladda upp en fil till rätt bucket baserat på mediatyp
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
 * Generera URL för att visa/ladda ner media
 * - Public buckets: returnerar public URL direkt
 * - Private buckets: genererar signed URL med expiration
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
    // Extrahera path från URL
    const match = storagePath.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
    if (match) {
      cleanPath = match[1];
    } else {
      // Kan inte extrahera path, returnera original
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
  
  // Private bucket → generera signed URL
  const { data, error } = await supabase.storage
    .from(config.bucket)
    .createSignedUrl(cleanPath, expiresInSeconds);
  
  if (error) {
    console.error(`Error creating signed URL for ${mediaType}:`, error);
    return null;
  }
  
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
