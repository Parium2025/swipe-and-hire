/**
 * 🔁 useOfflineJobQueue — Bakgrundssync av kö-lagrade annons-operationer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import {
  enqueueJobOperation,
  getQueuedJobs,
  removeQueuedJob,
  updateQueuedJob,
  JOB_QUEUE_MAX_ATTEMPTS,
  type QueuedJobOperation,
  type JobOperationType,
} from '@/lib/offlineJobQueue';

export function useOfflineJobQueue(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<QueuedJobOperation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncInProgressRef = useRef(false);

  const refreshQueue = useCallback(async () => {
    if (!userId) {
      setQueue([]);
      return;
    }
    const items = await getQueuedJobs(userId);
    setQueue(items);
  }, [userId]);

  useEffect(() => { void refreshQueue(); }, [refreshQueue]);

  const enqueue = useCallback(async (
    operation: JobOperationType,
    payload: Record<string, unknown>,
    jobId?: string,
  ) => {
    if (!userId) return null;
    const id = await enqueueJobOperation({
      userId,
      operation,
      jobId,
      payload: payload as never,
    });
    await refreshQueue();
    toast('Annonsen är sparad lokalt', {
      description: 'Vi publicerar den så fort du är online igen.',
    });
    return id;
  }, [userId, refreshQueue]);

  const flushQueue = useCallback(async () => {
    if (!userId || syncInProgressRef.current) return;
    if (!getIsOnline()) return;

    const items = await getQueuedJobs(userId);
    if (items.length === 0) return;

    syncInProgressRef.current = true;
    setSyncing(true);

    let synced = 0;
    let failed = 0;

    for (const item of items) {
      try {
        if (item.attempts > 0) {
          const delay = Math.min(1000 * Math.pow(2, item.attempts - 1), 30000);
          await new Promise(r => setTimeout(r, delay));
        }

        if (item.operation === 'insert') {
          const { error } = await supabase.from('job_postings').insert(item.payload as never);
          if (error) throw error;
        } else {
          if (!item.jobId) throw new Error('Saknar job ID för update');
          const { error } = await supabase
            .from('job_postings')
            .update(item.payload as never)
            .eq('id', item.jobId);
          if (error) throw error;
        }

        await removeQueuedJob(item.id);
        synced++;
      } catch (err) {
        const newAttempts = item.attempts + 1;
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.warn('[jobQueue] flush failed', item.id, errMsg);

        if (newAttempts >= JOB_QUEUE_MAX_ATTEMPTS) {
          await removeQueuedJob(item.id);
          failed++;
        } else {
          await updateQueuedJob(item.id, { attempts: newAttempts, lastError: errMsg });
        }
      }
    }

    await refreshQueue();
    syncInProgressRef.current = false;
    setSyncing(false);

    if (synced > 0) {
      // Invalidera cache så dashboard uppdateras
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['employer-jobs-counts'] });
      toast.success(synced === 1 ? 'Annons publicerad' : `${synced} annonser publicerade`);
    }
    if (failed > 0) {
      toast.error(`${failed} ${failed === 1 ? 'annons' : 'annonser'} kunde inte publiceras`, {
        description: 'Vänligen försök igen manuellt.',
        duration: 8000,
      });
    }
  }, [userId, refreshQueue, queryClient]);

  useEffect(() => {
    if (!userId) return;
    const unsub = onConnectivityChange((online) => {
      if (online) {
        console.log('📡 Back online — flushing job queue…');
        void flushQueue();
      }
    });
    if (getIsOnline()) void flushQueue();
    return unsub;
  }, [userId, flushQueue]);

  return {
    queue,
    enqueue,
    flushQueue,
    syncing,
    hasQueued: queue.length > 0,
    queueLength: queue.length,
  };
}
