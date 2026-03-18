import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { clearMyApplicationsLocalCache } from '@/hooks/useMyApplicationsCache';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import { notifySwOfPendingOps } from '@/lib/offlineSyncEngine';

/**
 * 🚀 OFFLINE JOB APPLICATION QUEUE
 * 
 * Queues job applications when the user is offline and syncs them
 * automatically when connectivity is restored. This prevents data loss
 * when applying from areas with poor connectivity (e.g. subway).
 * 
 * Pattern:
 * 1. User submits application offline → queued in localStorage
 * 2. UI shows optimistic "Ansökan köad – skickas automatiskt"
 * 3. When online event fires → sync all queued applications
 * 4. On success → clear draft, invalidate caches, show toast
 * 5. On failure → retry up to MAX_ATTEMPTS, then notify user
 */

export interface QueuedApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  applicantId: string;
  payload: {
    job_id: string;
    applicant_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    age: number | null;
    location: string;
    bio: string;
    cv_url: string;
    profile_image_snapshot_url: string | null;
    video_snapshot_url: string | null;
    custom_answers: Record<string, any>;
  };
  emailPayload: {
    applicant_email: string;
    applicant_first_name: string;
    job_title: string;
    company_name: string;
  };
  queuedAt: number;
  attempts: number;
}

const QUEUE_KEY = 'parium_offline_application_queue';
const MAX_ATTEMPTS = 3;

/**
 * Validates that a parsed object has the required QueuedApplication shape.
 * Protects against corrupt localStorage data causing runtime crashes.
 */
function isValidQueuedApplication(item: unknown): item is QueuedApplication {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.jobId === 'string' &&
    typeof obj.applicantId === 'string' &&
    typeof obj.queuedAt === 'number' &&
    typeof obj.attempts === 'number' &&
    obj.payload != null && typeof obj.payload === 'object'
  );
}

function getQueue(): QueuedApplication[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidQueuedApplication);
  } catch {
    try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
    return [];
  }
}

function saveQueue(queue: QueuedApplication[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    console.error('Failed to save offline application queue');
  }
}

export function useOfflineApplicationQueue(userId: string | undefined) {
  const [queue, setQueue] = useState<QueuedApplication[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  // Load queue on mount
  useEffect(() => {
    if (userId) {
      const stored = getQueue().filter(a => a.applicantId === userId);
      setQueue(stored);
    }
  }, [userId]);

  // Enqueue application
  const enqueueApplication = useCallback((app: Omit<QueuedApplication, 'id' | 'queuedAt' | 'attempts'>) => {
    const queued: QueuedApplication = {
      ...app,
      id: `offline-app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      queuedAt: Date.now(),
      attempts: 0,
    };

    // Deduplicate: only one pending application per job
    const currentQueue = getQueue();
    const filtered = currentQueue.filter(q => !(q.jobId === app.jobId && q.applicantId === app.applicantId));
    const newQueue = [...filtered, queued];
    saveQueue(newQueue);
    setQueue(prev => [...prev.filter(q => !(q.jobId === app.jobId && q.applicantId === app.applicantId)), queued]);

    notifySwOfPendingOps();
    return queued;
  }, []);

  // Sync a single application
  const syncApplication = async (app: QueuedApplication): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('job_applications')
        .insert(app.payload);

      if (error) {
        // Duplicate key = already submitted (success)
        if (error.code === '23505') return true;
        throw error;
      }

      // Send confirmation email in background
      supabase.functions.invoke('send-application-confirmation', { body: app.emailPayload })
        .then(({ error }) => {
          if (error) console.error('❌ Offline app confirmation email failed:', error);
          else console.log('✅ Offline app confirmation email sent');
        })
        .catch((e) => console.error('❌ Offline app confirmation email network error:', e));

      return true;
    } catch (error) {
      console.error('Failed to sync queued application:', error);
      return false;
    }
  };

  // Sync all queued applications
  const syncQueue = useCallback(async () => {
    if (!userId || syncInProgress.current) return;

    const currentQueue = getQueue().filter(a => a.applicantId === userId);
    if (currentQueue.length === 0) return;

    syncInProgress.current = true;
    setSyncing(true);

    const remaining: QueuedApplication[] = [];
    let synced = 0;
    const syncedJobIds: string[] = [];

    for (const app of currentQueue) {
      const success = await syncApplication(app);

      if (success) {
        synced++;
        syncedJobIds.push(app.jobId);

        // Clear application draft
        try {
          localStorage.removeItem(`parium_draft_job-application-${app.jobId}`);
        } catch { /* ignore */ }
      } else {
        const updated = { ...app, attempts: app.attempts + 1 };
        if (updated.attempts < MAX_ATTEMPTS) {
          remaining.push(updated);
        } else {
          console.warn('Application exceeded max attempts, dropping:', app.jobId);
          // Notify user about the failed application
          toast.error(`Ansökan till "${app.jobTitle}" kunde inte skickas`, {
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
      // Clear caches so UI updates
      clearMyApplicationsLocalCache();

      toast.success(
        synced === 1
          ? `Ansökan skickad! ✓`
          : `${synced} ansökningar skickade! ✓`,
        {
          description: synced === 1
            ? `Din ansökan har skickats till arbetsgivaren`
            : `Alla köade ansökningar har skickats`,
          duration: 5000,
        }
      );
    }
  }, [userId]);

  // Auto-sync on connectivity restore
  useEffect(() => {
    const unsub = onConnectivityChange((online) => {
      if (online) {
        console.log('📡 Back online — syncing application queue...');
        syncQueue();
      }
    });

    // Also sync on mount if online and queue has items
    if (getIsOnline() && queue.length > 0) {
      syncQueue();
    }

    return unsub;
  }, [syncQueue, queue.length]);

  // Check if a specific job has a queued application
  const isJobQueued = useCallback((jobId: string) => {
    return queue.some(a => a.jobId === jobId);
  }, [queue]);

  return {
    queue,
    enqueueApplication,
    syncQueue,
    isJobQueued,
    syncing,
    hasQueued: queue.length > 0,
  };
}
