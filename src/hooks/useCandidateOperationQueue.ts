import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import { executeWithConflictCheck, notifySwOfPendingOps } from '@/lib/offlineSyncEngine';
import { safeSetItem } from '@/lib/safeStorage';

/**
 * 🚀 CANDIDATE OPERATION RETRY QUEUE
 * 
 * Queues candidate operations (rating, stage move, notes, remove) when
 * the network is unavailable or an API call fails. Operations are stored
 * in localStorage and automatically retried when connectivity returns.
 *
 * Pattern matches useOfflineApplicationQueue for consistency:
 * 1. Operation fails or user is offline → queued in localStorage
 * 2. UI shows optimistic update immediately
 * 3. When online → auto-sync all queued operations
 * 4. On success → remove from queue
 * 5. On failure → retry up to MAX_ATTEMPTS, then notify user
 */

export type CandidateOperationType = 'stage_move' | 'rating_update' | 'notes_update' | 'remove';

export interface QueuedCandidateOperation {
  id: string;
  type: CandidateOperationType;
  candidateId: string;        // my_candidates.id
  applicantId?: string;       // profiles.user_id (for persistent rating/notes)
  recruiterId: string;
  payload: Record<string, any>;
  queuedAt: number;
  attempts: number;
  candidateName?: string;     // For user-facing messages
}

const QUEUE_KEY = 'parium_candidate_ops_queue';
const MAX_ATTEMPTS = 3;

// ── localStorage helpers ──────────────────────────────────────────────

const MAX_QUEUE_SIZE = 50;

function isValidQueuedOp(item: unknown): item is QueuedCandidateOperation {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.candidateId === 'string' &&
    typeof obj.recruiterId === 'string' &&
    typeof obj.queuedAt === 'number' &&
    typeof obj.attempts === 'number' &&
    obj.payload != null && typeof obj.payload === 'object'
  );
}

function getQueue(): QueuedCandidateOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidQueuedOp);
  } catch {
    try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
    return [];
  }
}

function saveQueue(queue: QueuedCandidateOperation[]) {
  const saved = safeSetItem(QUEUE_KEY, JSON.stringify(queue));
  if (!saved) {
    console.error('[CandidateOpsQueue] Failed to persist queue — localStorage full even after eviction');
  }
}
  }
}

// ── Public enqueue (can be called outside React) ──────────────────────

export function enqueueCandidateOperation(
  op: Omit<QueuedCandidateOperation, 'id' | 'queuedAt' | 'attempts'>
): QueuedCandidateOperation {
  const queued: QueuedCandidateOperation = {
    ...op,
    id: `cop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    queuedAt: Date.now(),
    attempts: 0,
  };

  const queue = getQueue();

  // Deduplicate: keep only the latest operation per candidateId+type
  const filtered = queue.filter(
    (q) => !(q.candidateId === op.candidateId && q.type === op.type)
  );

  // Cap queue size to prevent localStorage overflow
  const newQueue = [...filtered, queued];
  saveQueue(newQueue);
  
  // Notify Service Worker so it can trigger sync when connectivity returns
  notifySwOfPendingOps();
  
  return queued;
}

// ── Execute a single operation ────────────────────────────────────────

async function executeOperation(op: QueuedCandidateOperation): Promise<boolean> {
  // Use conflict checking for operations that update existing records
  if (op.type === 'stage_move' || op.type === 'rating_update' || op.type === 'notes_update') {
    const result = await executeWithConflictCheck(
      'my_candidates',
      op.candidateId,
      op.queuedAt,
      () => executeOperationInner(op)
    );
    if (result.reason === 'conflict') {
      console.log(`[CandidateOpsQueue] Dropped ${op.type} for ${op.candidateId} — server is newer`);
      return true; // Treat as success (don't retry)
    }
    return result.applied;
  }

  return executeOperationInner(op);
}

async function executeOperationInner(op: QueuedCandidateOperation): Promise<boolean> {
  try {
    switch (op.type) {
      case 'stage_move': {
        const { error } = await supabase
          .from('my_candidates')
          .update({ stage: op.payload.stage })
          .eq('id', op.candidateId);
        if (error) throw error;
        return true;
      }

      case 'rating_update': {
        const { error } = await supabase
          .from('my_candidates')
          .update({ rating: op.payload.rating })
          .eq('id', op.candidateId);
        if (error) throw error;

        if (op.applicantId && op.recruiterId) {
          await supabase
            .from('candidate_ratings')
            .upsert(
              {
                recruiter_id: op.recruiterId,
                applicant_id: op.applicantId,
                rating: op.payload.rating,
              },
              { onConflict: 'recruiter_id,applicant_id' }
            );
        }
        return true;
      }

      case 'notes_update': {
        const { error } = await supabase
          .from('my_candidates')
          .update({ notes: op.payload.notes })
          .eq('id', op.candidateId);
        if (error) throw error;

        if (op.applicantId && op.recruiterId) {
          const { data: existing } = await supabase
            .from('candidate_notes')
            .select('id')
            .eq('employer_id', op.recruiterId)
            .eq('applicant_id', op.applicantId)
            .is('job_id', null)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('candidate_notes')
              .update({ note: op.payload.notes })
              .eq('id', existing.id);
          } else if (op.payload.notes?.trim()) {
            await supabase
              .from('candidate_notes')
              .insert({
                employer_id: op.recruiterId,
                applicant_id: op.applicantId,
                note: op.payload.notes,
                job_id: null,
              });
          }
        }
        return true;
      }

      case 'remove': {
        const { error } = await supabase
          .from('my_candidates')
          .delete()
          .eq('id', op.candidateId);
        if (error) throw error;
        return true;
      }

      default:
        console.warn('[CandidateOpsQueue] Unknown operation type:', op.type);
        return false;
    }
  } catch (err) {
    console.error('[CandidateOpsQueue] Operation failed:', op.type, err);
    return false;
  }
}

// ── Sync all queued operations ────────────────────────────────────────

let syncLock = false;

export async function syncCandidateOperationQueue(userId?: string): Promise<number> {
  if (syncLock) return 0;
  syncLock = true;

  try {
    let queue = getQueue();
    if (userId) queue = queue.filter((q) => q.recruiterId === userId);
    if (queue.length === 0) return 0;

    console.log(`[CandidateOpsQueue] Syncing ${queue.length} queued operations...`);

    const remaining: QueuedCandidateOperation[] = [];
    let synced = 0;

    for (let i = 0; i < queue.length; i++) {
      const op = queue[i];
      
      // Exponential backoff: wait before retrying failed ops
      if (op.attempts > 0) {
        const delay = Math.min(1000 * Math.pow(2, op.attempts - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const success = await executeOperation(op);

      if (success) {
        synced++;
      } else {
        const updated = { ...op, attempts: op.attempts + 1 };
        if (updated.attempts < MAX_ATTEMPTS) {
          remaining.push(updated);
        } else {
          // Exhausted retries
          const label = getOperationLabel(op);
          toast.error(`${label} kunde inte synkas`, {
            description: op.candidateName
              ? `Åtgärd för ${op.candidateName} misslyckades efter ${MAX_ATTEMPTS} försök.`
              : `Försök igen manuellt.`,
            duration: 8000,
          });
        }
      }
    }

    // Re-read and keep ops for other users untouched
    const fullQueue = getQueue();
    const otherUserOps = userId
      ? fullQueue.filter((q) => q.recruiterId !== userId)
      : [];
    saveQueue([...otherUserOps, ...remaining]);

    if (synced > 0) {
      console.log(`[CandidateOpsQueue] ✅ Synced ${synced} operations`);
      toast.success(
        synced === 1
          ? 'Köad ändring synkad ✓'
          : `${synced} köade ändringar synkade ✓`,
        { duration: 3000 }
      );
    }

    return synced;
  } finally {
    syncLock = false;
  }
}

// ── Human-readable labels ─────────────────────────────────────────────

function getOperationLabel(op: QueuedCandidateOperation): string {
  switch (op.type) {
    case 'stage_move':
      return 'Flytt av kandidat';
    case 'rating_update':
      return 'Betygsändring';
    case 'notes_update':
      return 'Anteckningsändring';
    case 'remove':
      return 'Borttagning av kandidat';
    default:
      return 'Kandidatändring';
  }
}

// ── Check if there are pending ops ────────────────────────────────────

export function hasPendingCandidateOps(userId?: string): boolean {
  const queue = getQueue();
  return userId ? queue.some((q) => q.recruiterId === userId) : queue.length > 0;
}

// ── React hook ────────────────────────────────────────────────────────

export function useCandidateOperationQueue(userId: string | undefined) {
  const syncInProgress = useRef(false);

  const sync = useCallback(async () => {
    if (!userId || syncInProgress.current) return;
    syncInProgress.current = true;
    try {
      await syncCandidateOperationQueue(userId);
    } finally {
      syncInProgress.current = false;
    }
  }, [userId]);

  // Auto-sync on connectivity restore
  useEffect(() => {
    if (!userId) return;

    const unsub = onConnectivityChange((online) => {
      if (online) {
        console.log('[CandidateOpsQueue] 📡 Back online — syncing queue...');
        sync();
      }
    });

    // Also sync on mount if online and queue has items
    if (getIsOnline() && hasPendingCandidateOps(userId)) {
      sync();
    }

    return unsub;
  }, [userId, sync]);

  return { sync, hasPending: userId ? hasPendingCandidateOps(userId) : false };
}
