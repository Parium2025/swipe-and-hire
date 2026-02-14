import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QueuedAction {
  jobId: string;
  action: 'save' | 'unsave';
  timestamp: number;
}

const QUEUE_KEY = 'parium_offline_saved_jobs_queue';

function getQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    console.error('Failed to save offline saved jobs queue');
  }
}

/**
 * Offline queue for saved job toggles.
 * Queues save/unsave actions when offline, syncs when back online.
 */
export function useOfflineSavedJobsQueue(userId: string | undefined) {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const syncInProgress = useRef(false);

  // Load queue on mount
  useEffect(() => {
    if (userId) {
      setQueue(getQueue());
    }
  }, [userId]);

  // Enqueue an action
  const enqueue = useCallback((jobId: string, action: 'save' | 'unsave') => {
    const currentQueue = getQueue();
    // Deduplicate: remove any existing action for this jobId, keep latest
    const filtered = currentQueue.filter(q => q.jobId !== jobId);
    const newQueue = [...filtered, { jobId, action, timestamp: Date.now() }];
    saveQueue(newQueue);
    setQueue(newQueue);
  }, []);

  // Sync all queued actions
  const syncQueue = useCallback(async () => {
    if (!userId || syncInProgress.current) return;

    const currentQueue = getQueue();
    if (currentQueue.length === 0) return;

    syncInProgress.current = true;
    let synced = 0;

    for (const item of currentQueue) {
      try {
        if (item.action === 'save') {
          const { error } = await supabase
            .from('saved_jobs')
            .insert({ user_id: userId, job_id: item.jobId });
          // Ignore duplicate key
          if (error && error.code !== '23505') throw error;
        } else {
          const { error } = await supabase
            .from('saved_jobs')
            .delete()
            .eq('user_id', userId)
            .eq('job_id', item.jobId);
          if (error) throw error;
        }
        synced++;
      } catch (err) {
        console.error('Failed to sync saved job action:', err);
      }
    }

    // Clear queue after sync
    saveQueue([]);
    setQueue([]);
    syncInProgress.current = false;

    if (synced > 0) {
      toast.success(`${synced} sparade jobb synkroniserade`);
    }
  }, [userId]);

  // Auto-sync when coming back online
  useEffect(() => {
    const handleOnline = () => {
      syncQueue();
    };

    window.addEventListener('online', handleOnline);

    // Try to sync on mount if online
    if (navigator.onLine && queue.length > 0) {
      syncQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncQueue, queue.length]);

  return {
    queue,
    enqueue,
    syncQueue,
    hasQueued: queue.length > 0,
  };
}
