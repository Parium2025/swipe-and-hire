import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import { notifySwOfPendingOps } from '@/lib/offlineSyncEngine';
import { safeSetItem } from '@/lib/safeStorage';
import {
  findExistingConversationId,
  createConversationForCandidate,
  ensureConversationMemberships,
} from '@/lib/conversationService';

const BULK_QUEUE_KEY = 'parium_bulk_message_queue';
const MAX_ATTEMPTS = 3;

interface QueuedMessage {
  id: string;
  sender_id: string;
  applicant_id: string;
  job_id: string;
  application_id: string;
  content: string;
  created_at: string;
  attempts: number;
}

function isValidQueuedMessage(item: unknown): item is QueuedMessage {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.sender_id === 'string' &&
    typeof obj.applicant_id === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.created_at === 'string' &&
    typeof obj.attempts === 'number'
  );
}

function getBulkQueue(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(BULK_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidQueuedMessage);
  } catch {
    try { localStorage.removeItem(BULK_QUEUE_KEY); } catch { /* ignore */ }
    return [];
  }
}

function saveBulkQueue(items: QueuedMessage[]) {
  try {
    localStorage.setItem(BULK_QUEUE_KEY, JSON.stringify(items));
  } catch {
    console.error('Failed to save bulk message queue');
  }
}

/**
 * Syncs queued bulk messages when connectivity is restored.
 */
export function useBulkMessageSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    let syncInProgress = false;

    const syncBulkQueue = async () => {
      if (syncInProgress) return;

      const items = getBulkQueue();
      if (items.length === 0) return;

      const myItems = items.filter((i) => i.sender_id === user.id);
      if (myItems.length === 0) return;

      syncInProgress = true;
      try {
        let sent = 0;
        const remaining = items.filter((i) => i.sender_id !== user.id);

        for (const item of myItems) {
          try {
            let convId = await findExistingConversationId(user.id, item.applicant_id);

            if (!convId) {
              convId = await createConversationForCandidate(
                user.id,
                item.applicant_id,
                item.job_id || null,
                item.application_id || null
              );
            }

            await ensureConversationMemberships(convId, user.id, item.applicant_id);

            const { error } = await supabase
              .from('conversation_messages')
              .insert({ conversation_id: convId, sender_id: user.id, content: item.content });

            if (error) throw error;
            sent++;
          } catch (e) {
            console.error('Failed to sync bulk queued message:', e);
            const nextAttempts = item.attempts + 1;
            if (nextAttempts < MAX_ATTEMPTS) {
              remaining.push({ ...item, attempts: nextAttempts });
            }
          }
        }

        saveBulkQueue(remaining);

        if (sent > 0) {
          toast.success(`${sent} köat meddelande${sent !== 1 ? 'n' : ''} skickat`);
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      } finally {
        syncInProgress = false;
      }
    };

    const unsubscribe = onConnectivityChange((online) => {
      if (online) {
        void syncBulkQueue();
      }
    });

    // Also try on mount
    if (getIsOnline()) {
      void syncBulkQueue();
    }

    return unsubscribe;
  }, [user, queryClient]);
}

