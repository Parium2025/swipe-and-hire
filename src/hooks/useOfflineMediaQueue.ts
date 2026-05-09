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
    const id = await enqueueMediaUpload({
      userId,
      blob: args.blob,
      fileName: args.fileName,
      mediaType: args.mediaType,
      targetTable: args.targetTable,
      targetField: args.targetField,
      targetId: args.targetId,
      targetIdColumn: args.targetIdColumn ?? (args.targetTable === 'profiles' ? 'user_id' : 'id'),
    });
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

        const bucket = BUCKETS[item.mediaType];
        await uploadWithRetry({
          bucket,
          path: item.fileName,
          file: item.blob,
          contentType: item.blob.type || 'application/octet-stream',
          upsert: true,
          maxAttempts: 3, // hooken har egen yttre retry → håll inre låg
        });

        // Uppdatera DB-raden med storage path
        const { error: dbError } = await supabase
          .from(item.targetTable as never)
          .update({ [item.targetField]: item.fileName } as never)
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
