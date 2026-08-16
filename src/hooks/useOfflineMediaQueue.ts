/**
 * 🔁 useOfflineMediaQueue — Hanterar bakgrundsuppladdning av kö-lagrade media.
 *
 * Användning:
 *   - Kalla enqueue() från valfri upload-flow när nätet ligger nere
 *   - Hooken lyssnar på onConnectivityChange + monterar
 *   - När online → flushQueue() försöker varje queued item med exponential backoff
 *   - Vid framgång → uppdaterar DB-rad med storage path → tar bort från kö
 *
 * UI-feedback:
 *   - hasQueued + queueLength för badges
 *   - syncing för spinner i status bar
 *   - Toast vid framgångsrik flush + permanent fail
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import { uploadWithRetry } from '@/lib/uploadWithProgress';
import {
  enqueueMediaUpload,
  getQueuedUploads,
  removeQueuedUpload,
  updateQueuedUpload,
  MEDIA_QUEUE_MAX_ATTEMPTS,
  type QueuedMediaUpload,
} from '@/lib/offlineMediaQueue';
import type { MediaType } from '@/lib/mediaManager';

const BUCKETS: Record<MediaType, string> = {
  'profile-image': 'job-applications',
  'profile-video': 'job-applications',
  'cover-image': 'job-applications',
  'cv': 'job-applications',
  'application-document': 'job-applications',
  'company-logo': 'company-logos',
  'job-image': 'job-images',
};

interface EnqueueArgs {
  blob: Blob;
  fileName: string;
  mediaType: MediaType;
  targetTable: string;
  targetField: string;
  targetId: string;
  targetIdColumn?: string;
}

export function useOfflineMediaQueue(userId: string | undefined) {
  const [queue, setQueue] = useState<QueuedMediaUpload[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncInProgressRef = useRef(false);

  const refreshQueue = useCallback(async () => {
    if (!userId) {
      setQueue([]);
      return;
    }
    const items = await getQueuedUploads(userId);
    setQueue(items);
  }, [userId]);

  useEffect(() => { void refreshQueue(); }, [refreshQueue]);

  const enqueue = useCallback(async (args: EnqueueArgs) => {
    if (!userId) return null;

    // 🔒 Kön får ALDRIG kringgå mediakedjan. Allt som köas bearbetas här och nu
    // (medan filen finns i minnet) — annars skulle en HEVC-video från iPhone
    // laddas upp rå när nätet kommer tillbaka och bli svart ruta på Android.
    let blob: Blob = args.blob;
    let fileName = args.fileName;
    // Sätts om bearbetningen inte kunde göras nu (offline → kodmodulen kan
    // inte hämtas). Då körs hela kedjan i stället vid flush, när vi är online.
    let pendingTranscode = false;

    if (args.mediaType === 'profile-video') {
      try {
        const { MAX_VIDEO_SECONDS, readVideoDurationFromBlob } = await import('@/lib/videoInput');
        const seconds = await readVideoDurationFromBlob(blob);
        if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
          toast('Videon är för lång', {
            description: `Max ${MAX_VIDEO_SECONDS} sekunder – korta ner den och försök igen.`,
          });
          return null;
        }

        const { optimizeVideoForUpload } = await import('@/lib/videoTranscode');
        const asFile = blob instanceof File ? blob : new File([blob], fileName.split('/').pop() || 'video.mp4', { type: blob.type });
        const result = await optimizeVideoForUpload(asFile);
        if (!result.playableEverywhere) {
          toast('Videon kunde inte sparas', {
            description: 'Formatet fungerar inte på alla enheter. Spara om den som MP4 (H.264) och försök igen.',
          });
          return null;
        }
        blob = result.blob;
        fileName = `${fileName.replace(/\.[^./]+$/, '')}.${result.extension}`;
      } catch (err) {
        // Offline kan en icke-cachad kodmodul inte hämtas. Att avvisa filen då
        // vore fel — vi sparar originalet och kör kedjan när nätet är tillbaka.
        if (!getIsOnline()) {
          pendingTranscode = true;
        } else {
          console.warn('[mediaQueue] transkodning misslyckades vid köning', err);
          toast('Videon kunde inte sparas', {
            description: 'Vi kunde inte bearbeta videon i din webbläsare. Prova en annan webbläsare eller spara om filen som MP4.',
          });
          return null;
        }
      }
    } else if ((blob.type || '').startsWith('image/') && blob.type !== 'image/svg+xml') {
      try {
        const { compressImageBlob } = await import('@/lib/imageUploadOptimization');
        blob = await compressImageBlob(blob, { maxDimension: 2560, quality: 0.9 });
      } catch {
        /* behåll originalet – bättre än att tappa filen */
      }
    }

    const id = await enqueueMediaUpload({
      userId,
      blob,
      fileName,
      mediaType: args.mediaType,
      targetTable: args.targetTable,
      targetField: args.targetField,
      targetId: args.targetId,
      targetIdColumn: args.targetIdColumn ?? (args.targetTable === 'profiles' ? 'user_id' : 'id'),
      pendingTranscode,
    });

    // IndexedDB kan vara helt blockerad (privat läge i vissa webbläsare) eller
    // full. Då får vi ALDRIG säga "sparad" — filen finns inte kvar någonstans.
    if (!id) {
      toast.error('Kunde inte spara filen lokalt', {
        description: 'Enhetens lagring är full eller blockerad i privat läge. Försök igen när du är online.',
        duration: 8000,
      });
      return null;
    }

    await refreshQueue();
    toast('Sparad lokalt', {
      description: 'Vi laddar upp den när du är online igen.',
    });
    return id;
  }, [userId, refreshQueue]);


  const flushQueue = useCallback(async () => {
    if (!userId || syncInProgressRef.current) return;
    if (!getIsOnline()) return;

    const items = await getQueuedUploads(userId);
    if (items.length === 0) return;

    syncInProgressRef.current = true;
    setSyncing(true);

    let synced = 0;
    let permanentlyFailed = 0;

    for (const item of items) {
      try {
        // Backoff baserat på antal tidigare försök för detta item
        if (item.attempts > 0) {
          const delay = Math.min(1000 * Math.pow(2, item.attempts - 1), 30000);
          await new Promise(r => setTimeout(r, delay));
        }

        let uploadBlob: Blob = item.blob;
        let uploadPath = item.fileName;

        // Videon köades utan bearbetning (offline). Kör hela mediakedjan nu,
        // innan något lämnar enheten — inget ospelbart får nå lagringen.
        if (item.pendingTranscode && item.mediaType === 'profile-video') {
          const { MAX_VIDEO_SECONDS, readVideoDurationFromBlob } = await import('@/lib/videoInput');
          const seconds = await readVideoDurationFromBlob(item.blob);
          if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
            await removeQueuedUpload(item.id);
            toast.error('En köad video var för lång', {
              description: `Max ${MAX_VIDEO_SECONDS} sekunder – ladda upp en kortare version.`,
              duration: 8000,
            });
            continue;
          }

          const { optimizeVideoForUpload } = await import('@/lib/videoTranscode');
          const asFile = item.blob instanceof File
            ? item.blob
            : new File([item.blob], item.fileName.split('/').pop() || 'video.mp4', { type: item.blob.type });
          const result = await optimizeVideoForUpload(asFile);
          if (!result.playableEverywhere) {
            await removeQueuedUpload(item.id);
            toast.error('En köad video kunde inte sparas', {
              description: 'Formatet fungerar inte på alla enheter. Spara om den som MP4 (H.264) och ladda upp igen.',
              duration: 8000,
            });
            continue;
          }
          uploadBlob = result.blob;
          uploadPath = `${item.fileName.replace(/\.[^./]+$/, '')}.${result.extension}`;
          await updateQueuedUpload(item.id, {
            blob: uploadBlob,
            fileName: uploadPath,
            pendingTranscode: false,
          });
        }

        const bucket = BUCKETS[item.mediaType];
        await uploadWithRetry({
          bucket,
          path: uploadPath,
          file: uploadBlob,
          contentType: uploadBlob.type || 'application/octet-stream',
          upsert: true,
          cacheControl: '31536000',
          maxAttempts: 3, // hooken har egen yttre retry → håll inre låg

        });

        // Uppdatera DB-raden med storage path
        const { error: dbError } = await supabase
          .from(item.targetTable as never)
          .update({ [item.targetField]: uploadPath } as never)
          .eq(item.targetIdColumn as never, item.targetId as never);

        if (dbError) throw dbError;

        await removeQueuedUpload(item.id);
        synced++;
      } catch (err) {
        const newAttempts = item.attempts + 1;
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.warn('[mediaQueue] flush item failed', item.id, errMsg);

        if (newAttempts >= MEDIA_QUEUE_MAX_ATTEMPTS) {
          await removeQueuedUpload(item.id);
          permanentlyFailed++;
        } else {
          await updateQueuedUpload(item.id, { attempts: newAttempts, lastError: errMsg });
        }
      }
    }

    await refreshQueue();
    syncInProgressRef.current = false;
    setSyncing(false);

    if (synced > 0) {
      toast.success(synced === 1 ? '1 fil uppladdad' : `${synced} filer uppladdade`);
    }
    if (permanentlyFailed > 0) {
      toast.error(`${permanentlyFailed} ${permanentlyFailed === 1 ? 'fil' : 'filer'} kunde inte laddas upp`, {
        description: 'Vänligen försök igen manuellt.',
        duration: 8000,
      });
    }
  }, [userId, refreshQueue]);

  useEffect(() => {
    if (!userId) return;

    const unsub = onConnectivityChange((online) => {
      if (online) {
        console.log('📡 Back online — flushing media queue…');
        void flushQueue();
      }
    });

    // Försök vid mount om vi redan är online
    if (getIsOnline()) {
      void flushQueue();
    }

    return unsub;
  }, [userId, flushQueue]);

  return {
    queue,
    enqueue,
    flushQueue,
    refreshQueue,
    syncing,
    hasQueued: queue.length > 0,
    queueLength: queue.length,
  };
}
