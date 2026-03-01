import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  findExistingConversationId,
  createConversationForCandidate,
  ensureConversationMemberships,
} from '@/lib/conversationService';

const BULK_QUEUE_KEY = 'parium_bulk_message_queue';

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

/**
 * Syncs queued bulk messages when the browser comes back online.
 * Previously inlined (~80 lines) inside CandidatesTable — now a
 * reusable hook that can be mounted anywhere in the component tree.
 */
export function useBulkMessageSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const syncBulkQueue = async () => {
      const raw = localStorage.getItem(BULK_QUEUE_KEY);
      if (!raw) return;

      const items: QueuedMessage[] = JSON.parse(raw);
      const myItems = items.filter((i) => i.sender_id === user.id);
      if (myItems.length === 0) return;

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

          await supabase
            .from('conversation_messages')
            .insert({ conversation_id: convId, sender_id: user.id, content: item.content });

          sent++;
        } catch (e) {
          console.error('Failed to sync bulk queued message:', e);
          if (item.attempts < 3) {
            remaining.push({ ...item, attempts: item.attempts + 1 });
          }
        }
      }

      localStorage.setItem(BULK_QUEUE_KEY, JSON.stringify(remaining));
      if (sent > 0) {
        toast.success(`${sent} köat meddelande${sent !== 1 ? 'n' : ''} skickat`);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    };

    const handleOnline = () => {
      if (navigator.onLine) syncBulkQueue();
    };

    window.addEventListener('online', handleOnline);
    // Also try on mount
    if (navigator.onLine) syncBulkQueue();

    return () => window.removeEventListener('online', handleOnline);
  }, [user, queryClient]);
}
