import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';

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
  queuedAt: number;
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
  const saved = safeSetItem(BULK_QUEUE_KEY, JSON.stringify(items));
  if (!saved) {
    console.error('[BulkMessageSync] Failed to save — localStorage full even after eviction');
  }
}

/**
 * Syncs queued bulk messages when connectivity is restored.
 */
// Delat lås: hooken kan vara monterad både globalt och på kandidatsidan.
let bulkSyncInProgress = false;
let retryTimerRef: ReturnType<typeof setTimeout> | null = null;

export function useBulkMessageSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const syncBulkQueue = async () => {
      if (bulkSyncInProgress) {
        // Försök igen strax: annars kan en blockerad körning tappas helt.
        if (!retryTimerRef) {
          retryTimerRef = setTimeout(() => {
            retryTimerRef = null;
            void syncBulkQueue();
          }, 3000);
        }
        return;
      }

      const items = getBulkQueue();
      if (items.length === 0) return;

      const myItems = items.filter((i) => i.sender_id === user.id);
      if (myItems.length === 0) return;

      bulkSyncInProgress = true;
      try {
        let sent = 0;
        const remaining = items.filter((i) => i.sender_id !== user.id);

        for (let i = 0; i < myItems.length; i++) {
          const item = myItems[i];
          // Exponential backoff for retried messages
          if (item.attempts > 0) {
            const delay = Math.min(1000 * Math.pow(2, item.attempts - 1), 30000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
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
              .insert({
                conversation_id: convId,
                sender_id: user.id,
                content: item.content,
                // Köade massutskick behåller bolagsidentiteten efter återanslutning.
                sender_identity: 'company',
              });

            if (error) throw error;
            sent++;
          } catch (e) {
            console.error('Failed to sync bulk queued message:', e);
            const nextAttempts = item.attempts + 1;
            if (nextAttempts < MAX_ATTEMPTS) {
              remaining.push({ ...item, attempts: nextAttempts });
            } else {
              toast.error('Ett massmeddelande kunde inte skickas', {
                description: 'Vänligen försök skicka det igen manuellt.',
                duration: 8000,
              });
            }
          }
        }

        // Läs kön igen: en annan flik kan ha lagt till poster medan vi skickade.
        const processedIds = new Set(myItems.map((i) => i.id));
        const latest = getBulkQueue().filter(
          (i) => i.sender_id !== user.id || !processedIds.has(i.id)
        );
        const merged = [...remaining.filter((i) => processedIds.has(i.id)), ...latest];
        saveBulkQueue(merged);

        if (sent > 0) {
          toast.success(`${sent} köat meddelande${sent !== 1 ? 'n' : ''} skickat`, { route: '/messages' } as Parameters<typeof toast.success>[1]);
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      } finally {
        bulkSyncInProgress = false;
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

