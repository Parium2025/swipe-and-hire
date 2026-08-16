import { supabase } from '@/integrations/supabase/client';
import { uploadWithRetry, type UploadProgress, UploadAbortedError } from '@/lib/uploadWithProgress';
import { isAcceptedVideoFile, readVideoDurationFromBlob, MAX_VIDEO_SECONDS } from '@/lib/videoInput';

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
    maxSizeMB: 50,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff', 'image/svg+xml']
  },
  'profile-video': {
    bucket: 'job-applications',
    isPublic: false,
    maxSizeMB: 50,
    // AVI utelämnas medvetet: ingen webbläsare kan spela upp det.
    allowedTypes: ['video/mp4', 'video/quicktime']

  },
  'cover-image': {
    bucket: 'job-applications',
    isPublic: false,
    maxSizeMB: 50,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff', 'image/svg+xml']
  },
  'cv': {
    bucket: 'job-applications',
    isPublic: false,
    maxSizeMB: 50,
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'text/plain']
  },
  'application-document': {
    bucket: 'job-applications',
    isPublic: false,
    maxSizeMB: 50,
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'text/plain', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  },
  'company-logo': {
    bucket: 'company-logos',
    isPublic: true,
    maxSizeMB: 50,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff', 'image/svg+xml']
  },
  'job-image': {
    bucket: 'job-images',
    isPublic: true,
    maxSizeMB: 50,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff', 'image/svg+xml']
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
export interface UploadMediaOptions {
  /** Optional progress callback (procent, bytes/s, ETA) */
  onProgress?: (progress: UploadProgress) => void;
  /** Avbryt mid-upload */
  signal?: AbortSignal;
  /** Notifiera UI om vilket retry-försök vi är på (1 = första försöket) */
  onAttempt?: (attempt: number) => void;
}

export async function uploadMedia(
  file: File,
  mediaType: MediaType,
  userId: string,
  options?: UploadMediaOptions
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
  
  // Validera filtyp. Videor valideras brett (alla format transkodas ändå till
  // H.264 – det är `playableEverywhere` nedan som avgör om filen får sparas).
  const videoBucket = config.allowedTypes.some((t) => t.startsWith('video/'));
  const acceptedAsVideo = videoBucket && isAcceptedVideoFile(file);
  if (!acceptedAsVideo && !config.allowedTypes.includes(file.type)) {
    return { 
      storagePath: '', 
      error: new Error(`Filtypen ${file.type || 'okänd'} är inte tillåten för ${mediaType}.`) 
    };
  }
  
  // 🖼️ Bilder komprimeras/skalas ned före upload. Användaren får ladda upp stora
  // original (upp till 50 MB), men vi lagrar en visningsoptimerad version — annars
  // kan bild-CDN:en inte transformera filen och bilden visas inte alls.
  let payload: Blob = file;
  let fileExt = file.name.split('.').pop() || 'bin';
  const isImage = file.type.startsWith('image/') && file.type !== 'image/svg+xml';
  if (isImage) {
    try {
      const { compressImageBlob, SAFE_UPLOAD_BYTES } = await import('@/lib/imageUploadOptimization');
      let compressed = await compressImageBlob(file, { maxDimension: 2560, quality: 0.9 });

      // Extremt detaljrika 4K/6K-bilder kan fortfarande bli stora → kör ett
      // hårdare pass så att bild-CDN:en garanterat kan transformera filen.
      if (compressed.size > SAFE_UPLOAD_BYTES) {
        compressed = await compressImageBlob(compressed, { maxDimension: 1920, quality: 0.82 });
      }

      if (compressed !== file) {
        payload = compressed;
        fileExt = compressed.type === 'image/jpeg' ? 'jpg' : compressed.type === 'image/png' ? 'png' : 'webp';
      }

      // Sista skyddsnätet: om komprimering inte gick att genomföra (t.ex. en
      // HEIC-fil i en webbläsare som inte kan avkoda den) vägrar vi hellre
      // uppladdningen än att spara en bild som aldrig går att visa.
      if (payload.size > SAFE_UPLOAD_BYTES) {
        return {
          storagePath: '',
          error: new Error(
            'Bilden kunde inte bearbetas i din webbläsare. Spara om den som JPEG eller PNG och försök igen.'
          ),
        };
      }
    } catch {
      // Fallback: ladda upp originalet om det är tillräckligt litet
      if (file.size > 6 * 1024 * 1024) {
        return {
          storagePath: '',
          error: new Error(
            'Bilden kunde inte bearbetas i din webbläsare. Spara om den som JPEG eller PNG och försök igen.'
          ),
        };
      }
    }
  }

  // 🎬 Videor komprimeras till 720p H.264 i enheten före upload. Det kapar både
  // lagring och utgående bandbredd med 60–80 % och gör filen spelbar överallt
  // (iPhone spelar annars in HEVC/MOV som Android/Windows inte alltid klarar).
  // Vi tar samtidigt fram en posterbild så att listor slipper röra videofilen.
  let posterBlob: Blob | null = null;
  const isVideo = acceptedAsVideo || file.type.startsWith('video/');
  if (isVideo) {
    // Hård längdgräns – enda källan till sanning, gäller alla uppladdningsvägar.
    const seconds = await readVideoDurationFromBlob(file);
    if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
      return {
        storagePath: '',
        error: new Error(
          `Videon är ${Math.round(seconds)} sekunder. Max längd är ${MAX_VIDEO_SECONDS} sekunder – korta ner den och försök igen.`
        ),
      };
    }

    let playableEverywhere = false;
    try {
      const { optimizeVideoForUpload } = await import('@/lib/videoTranscode');
      const result = await optimizeVideoForUpload(file);
      payload = result.blob;
      fileExt = result.extension;
      posterBlob = result.poster;
      playableEverywhere = result.playableEverywhere;
    } catch (error) {
      console.warn('[mediaManager] videokomprimering hoppades över:', error);
    }

    // Skyddsnät: gick komprimeringen inte att köra och originalet inte är
    // H.264 (t.ex. HEVC från iPhone) skulle videon bli osynlig för alla på
    // Android och Windows. Vi vägrar hellre uppladdningen än att lagra den.
    if (!playableEverywhere) {
      return {
        storagePath: '',
        error: new Error(
          'Videon kunde inte bearbetas i din webbläsare och formatet fungerar inte på alla enheter. Prova en annan webbläsare, eller spela in/spara om videon som MP4 (H.264).'
        ),
      };
    }
  }


  // Skapa unikt filnamn
  const safeExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${safeExt}`;
  
  // 🚀 Resilient upload: XHR + retry med exponential backoff + progress
  try {
    await uploadWithRetry({
      bucket: config.bucket,
      path: fileName,
      file: payload,
      contentType: payload.type || file.type,
      cacheControl: '31536000',
      upsert: true,
      signal: options?.signal,
      onProgress: options?.onProgress,
      onAttempt: options?.onAttempt,
    });
  } catch (uploadError) {
    if (uploadError instanceof UploadAbortedError) {
      return { storagePath: '', error: uploadError };
    }
    console.error(`Upload error for ${mediaType}:`, uploadError);
    return {
      storagePath: '',
      error: uploadError instanceof Error ? uploadError : new Error('Uppladdning misslyckades'),
    };
  }
  

  // Posterbilden laddas upp på en härledd sökväg bredvid videon. Den är
  // best-effort: misslyckas den faller uppspelningen tillbaka på videon själv.
  if (posterBlob) {
    try {
      await supabase.storage
        .from(config.bucket)
        .upload(getVideoPosterPath(fileName), posterBlob, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: true,
        });
    } catch (posterError) {
      console.warn('[mediaManager] posterbild kunde inte sparas:', posterError);
    }
  }

  // Returnera ENDAST storage path (aldrig URL)
  return { storagePath: fileName };
}

/**
 * Härled sökvägen till en videos posterbild. Samma bucket, samma mapp.
 * Finns ingen poster (äldre videor) returnerar signeringen null och UI:t
 * faller tillbaka på sitt vanliga beteende.
 */
export function getVideoPosterPath(videoPath: string): string {
  if (!videoPath) return '';
  return `${videoPath.replace(/\.[^./]+$/, '')}-poster.jpg`;
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
/**
 * Optional image transform options for Supabase Image Transformations.
 * Only applied when present — never changes default visual output.
 * width/height are CSS pixels; we automatically render at 2x for retina.
 */
export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100, default 80
  resize?: 'cover' | 'contain' | 'fill';
}

export async function getMediaUrl(
  storagePath: string,
  mediaType: MediaType,
  expiresInSeconds: number = 86400, // 24 timmar default
  transform?: ImageTransformOptions
): Promise<string | null> {
  if (!storagePath) return null;
  
  const config = MEDIA_CONFIG[mediaType];
  
  // Om det redan är en full URL, extrahera storage path först
  let cleanPath = storagePath;
  if (storagePath.startsWith('http')) {
    // Legacy: äldre format som pekar på public/profile-media. Mappa till path i job-applications.
    // Ex: .../storage/v1/object/public/profile-media/<userId>/<file>
    const legacyProfileMediaMatch = storagePath.match(
      /\/storage\/v1\/object\/(?:public|sign)\/profile-media\/(.+?)(?:\?|$)/
    );
    if (legacyProfileMediaMatch) {
      cleanPath = legacyProfileMediaMatch[1];
    } else {
      // Extract path from other URL formats
      const match = storagePath.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
      if (match) {
        cleanPath = match[1];
      } else {
        // Cannot extract path, return original
        return storagePath;
      }
    }
  }
  
  // Build transform payload (only for image types) — retina-aware (2x)
  const isImageType =
    mediaType === 'profile-image' ||
    mediaType === 'cover-image' ||
    mediaType === 'company-logo' ||
    mediaType === 'job-image';
  const t = transform && isImageType ? {
    ...(transform.width ? { width: Math.round(transform.width * 2) } : {}),
    ...(transform.height ? { height: Math.round(transform.height * 2) } : {}),
    quality: transform.quality ?? 80,
    ...(transform.resize ? { resize: transform.resize } : { resize: 'cover' as const }),
  } : undefined;
  
  // Public bucket → returnera public URL (med ev. transform)
  if (config.isPublic) {
    const { data } = supabase.storage
      .from(config.bucket)
      .getPublicUrl(cleanPath, t ? { transform: t } : undefined);
    return data.publicUrl;
  }
  
  // Private bucket → generera signed URL (med ev. transform)
  const { data, error } = await supabase.storage
    .from(config.bucket)
    .createSignedUrl(cleanPath, expiresInSeconds, t ? { transform: t } : undefined);
  
  if (error) {
    console.error(`Error creating signed URL for ${mediaType}:`, error);

    // OBS: den gamla publika bucketen 'profile-media' finns inte längre.
    // Tidigare fallback hit gav en URL som alltid 404:ade, vilket renderade
    // en trasig bild i stället för korrekt platshållare/initialer.
    // Returnera null så att UI:t faller tillbaka på sin placeholder.
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
