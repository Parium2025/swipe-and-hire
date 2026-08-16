/**
 * 🎯 useResilientUpload — React-hook för uppladdning med progress, retry och abort.
 *
 * Hanterar hela livscykeln för en fil-uppladdning:
 *   - Komprimerar bilder automatiskt (via befintlig compressImageBlob)
 *   - Validerar fil mot mediaConfig (storlek, typ)
 *   - Visar realtidsprogress (procent, MB, hastighet, tid kvar)
 *   - Retry med exponential backoff vid nätverksfel
 *   - Cancel-stöd via AbortController
 *   - Returnerar ENDAST storage path (samma kontrakt som uploadMedia)
 *
 * Designprinciper:
 *   - Konsekvent feltext på svenska
 *   - Toast-feedback vid fail (inte nedtystade fel)
 *   - 100% bakåtkompatibel: kan användas där uploadMedia används
 */

import { useCallback, useRef, useState } from 'react';
import { isAcceptedVideoFile, looksLikeVideoFile, readVideoDurationFromBlob, MAX_VIDEO_SECONDS, ACCEPTED_VIDEO_MIME } from '@/lib/videoInput';
import { toast } from 'sonner';
import { uploadWithRetry, UploadAbortedError, type UploadProgress } from '@/lib/uploadWithProgress';
import { compressImageBlob } from '@/lib/imageUploadOptimization';
import type { MediaType } from '@/lib/mediaManager';

interface MediaConfig {
  bucket: string;
  maxSizeMB: number;
  allowedTypes: string[];
  shouldCompress: boolean;
}

const MEDIA_CONFIG: Record<MediaType, MediaConfig> = {
  'profile-image': {
    bucket: 'job-applications',
    maxSizeMB: 50,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff', 'image/svg+xml'],
    shouldCompress: true,
  },
  'profile-video': {
    bucket: 'job-applications',
    maxSizeMB: 50,
    // Bred lista: allt transkodas till H.264 i enheten före upload.
    allowedTypes: [...ACCEPTED_VIDEO_MIME],
    shouldCompress: false,
  },
  'cover-image': {
    bucket: 'job-applications',
    maxSizeMB: 50,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff', 'image/svg+xml'],
    shouldCompress: true,
  },
  'cv': {
    bucket: 'job-applications',
    maxSizeMB: 50,
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'text/plain'],
    shouldCompress: false,
  },
  'application-document': {
    bucket: 'job-applications',
    maxSizeMB: 50,
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'text/plain', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    shouldCompress: false,
  },
  'company-logo': {
    bucket: 'company-logos',
    maxSizeMB: 50,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff', 'image/svg+xml'],
    shouldCompress: true,
  },
  'job-image': {
    bucket: 'job-images',
    maxSizeMB: 50,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff', 'image/svg+xml'],
    shouldCompress: true,
  },
};

export type UploadStatus = 'idle' | 'preparing' | 'uploading' | 'retrying' | 'success' | 'error' | 'aborted';

export interface UploadState {
  status: UploadStatus;
  progress: UploadProgress | null;
  attempt: number;
  error: string | null;
  storagePath: string | null;
}

const INITIAL_STATE: UploadState = {
  status: 'idle',
  progress: null,
  attempt: 0,
  error: null,
  storagePath: null,
};

export interface UseResilientUploadResult {
  state: UploadState;
  upload: (file: File, mediaType: MediaType, userId: string) => Promise<string | null>;
  abort: () => void;
  reset: () => void;
}

export function useResilientUpload(): UseResilientUploadResult {
  const [state, setState] = useState<UploadState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const upload = useCallback(async (
    file: File,
    mediaType: MediaType,
    userId: string,
  ): Promise<string | null> => {
    const config = MEDIA_CONFIG[mediaType];

    // Validering: storlek
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > config.maxSizeMB) {
      const msg = `Filen är för stor. Max ${config.maxSizeMB} MB tillåtet.`;
      setState({ ...INITIAL_STATE, status: 'error', error: msg });
      toast.error(msg);
      return null;
    }

    // Validering: typ. Videor tas emot brett – de transkodas till H.264 och
    // stoppas längre ner om de inte kan göras spelbara överallt.
    const videoBucket = config.allowedTypes.some((t) => t.startsWith('video/'));
    const acceptedAsVideo = videoBucket && isAcceptedVideoFile(file);
    if (!acceptedAsVideo && !config.allowedTypes.includes(file.type)) {
      const msg = 'Filtypen stöds inte.';
      setState({ ...INITIAL_STATE, status: 'error', error: msg });
      toast.error(msg);
      return null;
    }

    // Avbryt ev. tidigare upload från samma hook-instans
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({ ...INITIAL_STATE, status: 'preparing' });

    try {
      // Komprimera bilder före upload
      let payload: Blob = file;
      let extension = file.name.split('.').pop() || '';
      if (config.shouldCompress) {
        const compressed = await compressImageBlob(file, { maxDimension: 1920, quality: 0.9 });
        payload = compressed;
        if (compressed !== file) extension = 'webp';
      }

      // 🎬 Video komprimeras till 720p H.264 i enheten före upload (bandbredd +
      // universell uppspelning). Misslyckas det laddas originalet upp.
      let posterBlob: Blob | null = null;
      if (acceptedAsVideo || looksLikeVideoFile(file)) {
        const seconds = await readVideoDurationFromBlob(file);
        if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
          const msg = `Videon är ${Math.round(seconds)} sekunder. Max längd är ${MAX_VIDEO_SECONDS} sekunder – korta ner den och försök igen.`;
          setState({ ...INITIAL_STATE, status: 'error', error: msg });
          toast.error('Videon är för lång', { description: msg });
          return null;
        }

        let playableEverywhere = false;
        try {
          const { optimizeVideoForUpload } = await import('@/lib/videoTranscode');
          const result = await optimizeVideoForUpload(file);
          payload = result.blob;
          extension = result.extension;
          posterBlob = result.poster;
          playableEverywhere = result.playableEverywhere;
        } catch (err) {
          console.warn('[useResilientUpload] videokomprimering hoppades över', err);
        }

        // Kunde vi varken komprimera eller verifiera H.264 skulle videon bli
        // ospelbar på Android/Windows. Stoppa i stället för att lagra den.
        if (!playableEverywhere) {
          const msg =
            'Videon kunde inte bearbetas i din webbläsare och formatet fungerar inte på alla enheter. Prova en annan webbläsare, eller spara om videon som MP4 (H.264).';
          setState({ ...INITIAL_STATE, status: 'error', error: msg });
          toast.error('Videoformatet stöds inte', { description: msg });
          return null;
        }
      }


      // Skapa unik storage path
      const safeExt = (extension || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

      setState((prev) => ({ ...prev, status: 'uploading' }));

      await uploadWithRetry({
        bucket: config.bucket,
        path: storagePath,
        file: payload,
        contentType: payload.type || file.type,
        upsert: true,
        signal: controller.signal,
        onAttempt: (attempt) => {
          setState((prev) => ({
            ...prev,
            status: attempt > 1 ? 'retrying' : 'uploading',
            attempt,
          }));
        },
        onProgress: (progress) => {
          setState((prev) => ({ ...prev, progress }));
        },
      });

      // Posterbild bredvid videon (best-effort).
      if (posterBlob) {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { getVideoPosterPath } = await import('@/lib/mediaManager');
          await supabase.storage.from(config.bucket).upload(getVideoPosterPath(storagePath), posterBlob, {
            contentType: 'image/jpeg',
            cacheControl: '31536000',
            upsert: true,
          });
        } catch (posterError) {
          console.warn('[useResilientUpload] posterbild kunde inte sparas', posterError);
        }
      }

      setState((prev) => ({ ...prev, status: 'success', storagePath }));
      abortControllerRef.current = null;
      return storagePath;
    } catch (err) {
      abortControllerRef.current = null;
      if (err instanceof UploadAbortedError) {
        setState({ ...INITIAL_STATE, status: 'aborted', error: 'Uppladdning avbruten' });
        return null;
      }
      const msg = err instanceof Error ? err.message : 'Uppladdning misslyckades';
      console.error('[useResilientUpload] failed', err);
      setState((prev) => ({ ...prev, status: 'error', error: msg }));
      toast.error('Uppladdning misslyckades', {
        description: 'Vi försökte flera gånger. Kontrollera din uppkoppling och försök igen.',
      });
      return null;
    }
  }, []);

  return { state, upload, abort, reset };
}
