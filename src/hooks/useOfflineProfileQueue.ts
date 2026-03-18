import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import { shouldApplyQueuedOp, notifySwOfPendingOps } from '@/lib/offlineSyncEngine';

/**
 * 🚀 OFFLINE PROFILE UPDATE QUEUE
 * 
 * Queues profile updates when the user is offline and syncs them
 * automatically when connectivity is restored. This prevents losing
 * carefully written bios or profile changes in poor connectivity.
 * 
 * Pattern:
 * 1. User saves profile offline → queued in localStorage
 * 2. UI shows optimistic "Ändringar köade – sparas automatiskt"
 * 3. When online event fires → sync queued update
 * 4. On success → clear draft, refresh profile, show toast
 * 5. On failure → retry up to MAX_ATTEMPTS, then notify user
 */

export interface QueuedProfileUpdate {
  id: string;
  userId: string;
  updates: Record<string, any>;
  queuedAt: number;
  attempts: number;
}

const QUEUE_KEY = 'parium_offline_profile_queue';
const MAX_ATTEMPTS = 3;
const MAX_QUEUE_SIZE = 10;

/**
 * Validates that a parsed object has the required QueuedProfileUpdate shape.
 * Protects against corrupt localStorage data causing runtime crashes.
 */
function isValidQueuedProfileUpdate(item: unknown): item is QueuedProfileUpdate {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.userId === 'string' &&
    typeof obj.queuedAt === 'number' &&
    typeof obj.attempts === 'number' &&
    obj.updates != null && typeof obj.updates === 'object'
  );
}

function getQueue(): QueuedProfileUpdate[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidQueuedProfileUpdate);
  } catch {
    try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
    return [];
  }
}

function saveQueue(queue: QueuedProfileUpdate[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    console.error('Failed to save offline profile queue');
  }
}

export function useOfflineProfileQueue(userId: string | undefined) {
  const [queue, setQueue] = useState<QueuedProfileUpdate[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  // Load queue on mount
  useEffect(() => {
    if (userId) {
      const stored = getQueue().filter(q => q.userId === userId);
      setQueue(stored);
    }
  }, [userId]);

  // Enqueue profile update
  const enqueueProfileUpdate = useCallback((updates: Record<string, any>) => {
    if (!userId) return null;

    const queued: QueuedProfileUpdate = {
      id: `offline-profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      updates,
      queuedAt: Date.now(),
      attempts: 0,
    };

    // Replace any existing queued update for this user (latest wins)
    const currentQueue = getQueue();
    const filtered = currentQueue.filter(q => q.userId !== userId);
    const newQueue = [...filtered, queued];
    saveQueue(newQueue);
    setQueue([queued]);

    // Notify SW for background sync
    notifySwOfPendingOps();

    return queued;
  }, [userId]);

  // Sync a single profile update
  const syncProfileUpdate = async (item: QueuedProfileUpdate): Promise<boolean> => {
    try {
      // Conflict check: only apply if our change is newer than server
      const shouldApply = await shouldApplyQueuedOp('profiles', item.userId, item.queuedAt, 'user_id');
      if (!shouldApply) {
        console.log('[ProfileQueue] Server has newer data — dropping queued update');
        return true; // Treat as success (don't retry)
      }

      const { error } = await supabase
        .from('profiles')
        .update(item.updates)
        .eq('user_id', item.userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to sync queued profile update:', error);
      return false;
    }
  };

  // Sync all queued updates
  const syncQueue = useCallback(async () => {
    if (!userId || syncInProgress.current) return;

    const currentQueue = getQueue().filter(q => q.userId === userId);
    if (currentQueue.length === 0) return;

    syncInProgress.current = true;
    setSyncing(true);

    const remaining: QueuedProfileUpdate[] = [];
    let synced = 0;

    for (const item of currentQueue) {
      const success = await syncProfileUpdate(item);

      if (success) {
        synced++;
        // Clear profile draft
        try {
          localStorage.removeItem('parium_draft_profile');
        } catch { /* ignore */ }
      } else {
        const updated = { ...item, attempts: item.attempts + 1 };
        if (updated.attempts < MAX_ATTEMPTS) {
          remaining.push(updated);
        } else {
          console.warn('Profile update exceeded max attempts, dropping');
          toast.error('Profiländringar kunde inte sparas', {
            description: 'Vänligen försök igen manuellt.',
            duration: 8000,
          });
        }
      }
    }

    saveQueue(remaining);
    setQueue(remaining);
    syncInProgress.current = false;
    setSyncing(false);

    if (synced > 0) {
      toast.success('Profil uppdaterad ✓', {
        description: 'Dina köade profiländringar har sparats',
        duration: 5000,
      });
    }
  }, [userId]);

  // Auto-sync on connectivity restore
  useEffect(() => {
    const unsub = onConnectivityChange((online) => {
      if (online) {
        console.log('📡 Back online — syncing profile queue...');
        syncQueue();
      }
    });

    // Also sync on mount if online and queue has items
    if (getIsOnline() && queue.length > 0) {
      syncQueue();
    }

    return unsub;
  }, [syncQueue, queue.length]);

  return {
    queue,
    enqueueProfileUpdate,
    syncQueue,
    syncing,
    hasQueued: queue.length > 0,
  };
}
