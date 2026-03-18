import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import { notifySwOfPendingOps } from '@/lib/offlineSyncEngine';
import { safeSetItem } from '@/lib/safeStorage';

interface QueuedAction {
  jobId: string;
  action: 'save' | 'unsave';
  timestamp: number;
  attempts: number;
}

const QUEUE_KEY = 'parium_offline_saved_jobs_queue';
const MAX_ATTEMPTS = 3;

/**
 * Validates parsed data has the correct QueuedAction shape.
 * Guards against corrupt localStorage entries causing runtime crashes.
 */
function isValidQueuedAction(item: unknown): item is QueuedAction {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.jobId === 'string' &&
    (obj.action === 'save' || obj.action === 'unsave') &&
    typeof obj.timestamp === 'number' &&
    typeof obj.attempts === 'number'
  );
}

function getQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidQueuedAction);
  } catch {
    try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
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
 * Uses ConnectivityManager for reliable online detection.
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
    const newQueue = [...filtered, { jobId, action, timestamp: Date.now(), attempts: 0 }];
    // Cap queue size
    if (newQueue.length > MAX_QUEUE_SIZE) {
      newQueue.splice(0, newQueue.length - MAX_QUEUE_SIZE);
    }
    saveQueue(newQueue);
    setQueue(newQueue);
    notifySwOfPendingOps();
  }, []);

  // Sync all queued actions
  const syncQueue = useCallback(async () => {
    if (!userId || syncInProgress.current) return;

    const currentQueue = getQueue();
    if (currentQueue.length === 0) return;

    syncInProgress.current = true;
    const remaining: QueuedAction[] = [];
    let synced = 0;

    for (let i = 0; i < currentQueue.length; i++) {
      const item = currentQueue[i];
      // Exponential backoff for retried operations
      if (item.attempts > 0) {
        const delay = Math.min(1000 * Math.pow(2, item.attempts - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
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
        const updated = { ...item, attempts: item.attempts + 1 };
        if (updated.attempts < MAX_ATTEMPTS) {
          remaining.push(updated);
        } else {
          console.warn('Saved job action exceeded max attempts, dropping:', item.jobId, item.action);
          toast.error('Ett sparat jobb kunde inte synkas', {
            description: 'Vänligen försök igen.',
            duration: 6000,
          });
        }
      }
    }

    saveQueue(remaining);
    setQueue(remaining);
    syncInProgress.current = false;

    if (synced > 0) {
      toast.success(`${synced} sparade jobb synkroniserade`);
    }
  }, [userId]);

  // Auto-sync using ConnectivityManager (ping-based, not navigator.onLine)
  useEffect(() => {
    const unsub = onConnectivityChange((online) => {
      if (online) {
        console.log('📡 Back online — syncing saved jobs queue...');
        syncQueue();
      }
    });

    if (getIsOnline() && queue.length > 0) {
      syncQueue();
    }

    return unsub;
  }, [syncQueue, queue.length]);

  return {
    queue,
    enqueue,
    syncQueue,
    hasQueued: queue.length > 0,
  };
}
