import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { clearMyApplicationsLocalCache } from '@/hooks/useMyApplicationsCache';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import { notifySwOfPendingOps } from '@/lib/offlineSyncEngine';
import { safeSetItem } from '@/lib/safeStorage';
import { isPermanentApplicationError } from '@/lib/applicationAnswerValidation';

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
    candidate_profile_label?: string | null;
    custom_answers: Record<string, any>;
    questions_snapshot?: unknown[];
  };
  emailPayload: {
    applicant_email: string;
    applicant_first_name: string;
    job_title: string;
    company_name: string;
  };
  queuedAt: number;
  attempts: number;
  failedPermanently?: boolean;
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

function saveQueue(queue: QueuedApplication[]): boolean {
  const saved = safeSetItem(QUEUE_KEY, JSON.stringify(queue));
  if (!saved) {
    console.error('[ApplicationQueue] Failed to save — localStorage full even after eviction');
    toast.error('Kunde inte spara ansökan lokalt', {
      description: 'Enhetens lagring är full. Frigör utrymme och försök igen.',
      duration: 8000,
    });
  }
  return saved;
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
  const syncApplication = async (app: QueuedApplication): Promise<'success' | 'retry' | 'permanent'> => {
    try {
      let payload = app.payload;

      // Äldre offlineköer skapades innan frågeögonblicksbilden blev obligatorisk.
      // Hämta den aktuella listan en gång vid replay så att de inte fastnar permanent.
      if (!Array.isArray(payload.questions_snapshot)) {
        const { data: questions, error: questionsError } = await supabase
          .from('job_questions')
          .select('*')
          .eq('job_id', app.jobId)
          .order('order_index');

        if (questionsError) throw questionsError;
        payload = { ...payload, questions_snapshot: questions ?? [] };
      }

      const { error } = await supabase
        .from('job_applications')
        .insert(payload);

      if (error) {
        // Duplicate key = already submitted (success)
        if (error.code === '23505') return 'success';
        if (isPermanentApplicationError(error)) return 'permanent';
        throw error;
      }

      // Send confirmation email in background
      supabase.functions.invoke('send-application-confirmation', { body: app.emailPayload })
        .then(({ error }) => {
          if (error) console.error('❌ Offline app confirmation email failed:', error);
          else console.log('✅ Offline app confirmation email sent');
        })
        .catch((e) => console.error('❌ Offline app confirmation email network error:', e));

      return 'success';
    } catch (error) {
      console.error('Failed to sync queued application:', error);
      return 'retry';
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

    for (let i = 0; i < currentQueue.length; i++) {
      const app = currentQueue[i];
      // Exponential backoff for retried operations
      if (app.failedPermanently) {
        remaining.push(app);
        continue;
      }
      if (app.attempts > 0) {
        const delay = Math.min(1000 * Math.pow(2, app.attempts - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const result = await syncApplication(app);

      if (result === 'success') {
        synced++;
        syncedJobIds.push(app.jobId);

        // Clear application draft
        try {
          localStorage.removeItem(`parium_draft_job-application-${app.jobId}`);
        } catch { /* ignore */ }
      } else if (result === 'permanent') {
        remaining.push({ ...app, failedPermanently: true });
        toast.error(`Ansökan till "${app.jobTitle}" behöver kontrolleras`, {
          description: 'Öppna ansökan och kontrollera de obligatoriska svaren innan du försöker igen.',
          duration: 8000,
        });
      } else {
        const updated = { ...app, attempts: app.attempts + 1 };
        if (updated.attempts < MAX_ATTEMPTS) {
          remaining.push(updated);
        } else {
          console.warn('Application exceeded max attempts, keeping for recovery:', app.jobId);
          remaining.push({ ...updated, failedPermanently: true });
          toast.error(`Ansökan till "${app.jobTitle}" kunde inte skickas`, {
            description: 'Ansökan finns kvar sparad på enheten så att du kan försöka igen.',
            duration: 8000,
          });
        }
      }
    }

    // Re-read and keep other users' applications untouched
    const fullQueue = getQueue();
    const otherUserApps = fullQueue.filter(a => a.applicantId !== userId);
    saveQueue([...otherUserApps, ...remaining]);
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
    if (getIsOnline() && getQueue().filter(a => a.applicantId === userId).length > 0) {
      syncQueue();
    }

    return unsub;
  }, [syncQueue, userId]);

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
