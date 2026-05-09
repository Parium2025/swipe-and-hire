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
    maxSizeMB: 10,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
    shouldCompress: true,
  },
  'profile-video': {
    bucket: 'job-applications',
    maxSizeMB: 50,
    allowedTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    shouldCompress: false,
  },
  'cover-image': {
    bucket: 'job-applications',
    maxSizeMB: 10,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    shouldCompress: true,
  },
  'cv': {
    bucket: 'job-applications',
    maxSizeMB: 10,
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    shouldCompress: false,
  },
  'application-document': {
    bucket: 'job-applications',
    maxSizeMB: 10,
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'],
    shouldCompress: false,
  },
  'company-logo': {
    bucket: 'company-logos',
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    shouldCompress: true,
  },
  'job-image': {
    bucket: 'job-images',
    maxSizeMB: 10,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
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

    // Validering: typ
    if (!config.allowedTypes.includes(file.type)) {
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
