import { useState, useEffect, useCallback, useRef } from 'react';
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

interface QueuedMessage {
  id: string;
  sender_id: string;
  recipient_id: string; // candidate user_id
  content: string;
  job_id: string | null;
  application_id?: string | null;
  created_at: string;
  queuedAt: number;
  attempts: number;
}

const QUEUE_KEY = 'parium_offline_message_queue';
const MAX_ATTEMPTS = 3;

function isValidQueuedMessage(item: unknown): item is QueuedMessage {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.sender_id === 'string' &&
    typeof obj.recipient_id === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.created_at === 'string' &&
    typeof obj.attempts === 'number'
  );
}

function getQueuedMessages(): QueuedMessage[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidQueuedMessage);
  } catch {
    try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
    return [];
  }
}

function saveQueuedMessages(messages: QueuedMessage[]) {
  const saved = safeSetItem(QUEUE_KEY, JSON.stringify(messages));
  if (!saved) {
    console.error('[MessageQueue] Failed to save — localStorage full even after eviction');
  }
}

export function useOfflineMessageQueue(userId: string | undefined) {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  useEffect(() => {
    if (userId) {
      const stored = getQueuedMessages().filter(m => m.sender_id === userId);
      setQueue(stored);
    }
  }, [userId]);

  const queueMessage = useCallback((message: {
    recipient_id: string;
    content: string;
    job_id: string | null;
    application_id?: string | null;
  }) => {
    if (!userId) return null;

    const queuedMessage: QueuedMessage = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sender_id: userId,
      recipient_id: message.recipient_id,
      content: message.content,
      job_id: message.job_id,
      application_id: message.application_id || null,
      created_at: new Date().toISOString(),
      queuedAt: Date.now(),
      attempts: 0,
    };

    const existing = getQueuedMessages();
    const newQueue = [...existing, queuedMessage];
    // Cap queue to prevent localStorage overflow
    if (newQueue.length > MAX_QUEUE_SIZE) {
      newQueue.splice(0, newQueue.length - MAX_QUEUE_SIZE);
    }
    saveQueuedMessages(newQueue);
    setQueue(prev => [...prev, queuedMessage]);
    notifySwOfPendingOps();
    return queuedMessage;
  }, [userId]);

  /** Sync a single queued message using the conversation system. */
  const syncMessage = async (message: QueuedMessage): Promise<boolean> => {
    try {
      // Find or create conversation with the recipient
      let conversationId = await findExistingConversationId(
        message.sender_id,
        message.recipient_id
      );

      if (!conversationId) {
        conversationId = await createConversationForCandidate(
          message.sender_id,
          message.recipient_id,
          message.job_id,
          message.application_id
        );
        await ensureConversationMemberships(
          conversationId,
          message.sender_id,
          message.recipient_id
        );
      }

      const { error } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: message.sender_id,
          content: message.content,
        });

      if (error) {
        if (error.code === '23505') return true; // Duplicate — already sent
        throw error;
      }
      return true;
    } catch (error) {
      console.error('Failed to sync message:', error);
      return false;
    }
  };

  const syncQueue = useCallback(async () => {
    if (!userId || syncInProgress.current) return;

    const currentQueue = getQueuedMessages().filter(m => m.sender_id === userId);
    if (currentQueue.length === 0) return;

    syncInProgress.current = true;
    setSyncing(true);

    const remaining: QueuedMessage[] = [];
    let syncedCount = 0;

    for (let i = 0; i < currentQueue.length; i++) {
      const message = currentQueue[i];
      // Exponential backoff for retried messages
      if (message.attempts > 0) {
        const delay = Math.min(1000 * Math.pow(2, message.attempts - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const success = await syncMessage(message);
      if (success) {
        syncedCount++;
      } else {
        const updatedMessage = { ...message, attempts: message.attempts + 1 };
        if (updatedMessage.attempts < MAX_ATTEMPTS) {
          remaining.push(updatedMessage);
        } else {
          console.warn('Message exceeded max attempts, dropping:', message.id);
          toast.error('Ett meddelande kunde inte skickas', {
            description: 'Vänligen försök skicka det igen manuellt.',
            duration: 8000,
          });
        }
      }
    }

    saveQueuedMessages(remaining);
    setQueue(remaining);
    setSyncing(false);
    syncInProgress.current = false;

    if (syncedCount > 0) {
      toast.success(`${syncedCount} ${syncedCount === 1 ? 'meddelande skickat' : 'meddelanden skickade'}`);
    }
  }, [userId]);

  useEffect(() => {
    const unsub = onConnectivityChange((online) => {
      if (online) {
        console.log('📡 Back online — syncing message queue...');
        syncQueue();
      }
    });

    if (getIsOnline() && queue.length > 0) {
      syncQueue();
    }

    return unsub;
  }, [syncQueue, queue.length]);

  const removeFromQueue = useCallback((messageId: string) => {
    const currentQueue = getQueuedMessages();
    const newQueue = currentQueue.filter(m => m.id !== messageId);
    saveQueuedMessages(newQueue);
    setQueue(prev => prev.filter(m => m.id !== messageId));
  }, []);

  const isQueued = useCallback((messageId: string) => {
    return queue.some(m => m.id === messageId);
  }, [queue]);

  return {
    queue,
    queueMessage,
    syncQueue,
    removeFromQueue,
    isQueued,
    syncing,
    hasQueued: queue.length > 0,
  };
}
