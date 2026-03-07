import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';

interface QueuedMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  job_id: string | null;
  created_at: string;
  attempts: number;
}

const QUEUE_KEY = 'parium_offline_message_queue';
const MAX_ATTEMPTS = 3;

/**
 * Validates that a parsed object has the required QueuedMessage shape.
 * Protects against corrupt localStorage data causing runtime crashes.
 */
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
    // Filter out any corrupt entries
    return parsed.filter(isValidQueuedMessage);
  } catch {
    // Corrupt data — wipe and start fresh
    try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
    return [];
  }
}

function saveQueuedMessages(messages: QueuedMessage[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(messages));
  } catch {
    console.error('Failed to save offline message queue');
  }
}

export function useOfflineMessageQueue(userId: string | undefined) {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  // Load queue on mount
  useEffect(() => {
    if (userId) {
      const stored = getQueuedMessages().filter(m => m.sender_id === userId);
      setQueue(stored);
    }
  }, [userId]);

  // Add message to queue
  const queueMessage = useCallback((message: {
    recipient_id: string;
    content: string;
    job_id: string | null;
  }) => {
    if (!userId) return null;

    const queuedMessage: QueuedMessage = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sender_id: userId,
      recipient_id: message.recipient_id,
      content: message.content,
      job_id: message.job_id,
      created_at: new Date().toISOString(),
      attempts: 0,
    };

    const newQueue = [...getQueuedMessages(), queuedMessage];
    saveQueuedMessages(newQueue);
    setQueue(prev => [...prev, queuedMessage]);

    return queuedMessage;
  }, [userId]);

  // Sync a single message
  const syncMessage = async (message: QueuedMessage): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: message.sender_id,
          recipient_id: message.recipient_id,
          content: message.content,
          job_id: message.job_id,
        });

      if (error) {
        // Duplicate = already sent (treat as success)
        if (error.code === '23505') return true;
        throw error;
      }
      return true;
    } catch (error) {
      console.error('Failed to sync message:', error);
      return false;
    }
  };

  // Sync all queued messages
  const syncQueue = useCallback(async () => {
    if (!userId || syncInProgress.current) return;
    
    const currentQueue = getQueuedMessages().filter(m => m.sender_id === userId);
    if (currentQueue.length === 0) return;

    syncInProgress.current = true;
    setSyncing(true);

    const remaining: QueuedMessage[] = [];
    let syncedCount = 0;

    for (const message of currentQueue) {
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

  // Auto-sync using ConnectivityManager (ping-based, not navigator.onLine)
  useEffect(() => {
    const unsub = onConnectivityChange((online) => {
      if (online) {
        console.log('📡 Back online — syncing message queue...');
        syncQueue();
      }
    });

    // Also sync on mount if online and queue has items
    if (getIsOnline() && queue.length > 0) {
      syncQueue();
    }

    return unsub;
  }, [syncQueue, queue.length]);

  // Remove message from queue (e.g., when user cancels)
  const removeFromQueue = useCallback((messageId: string) => {
    const currentQueue = getQueuedMessages();
    const newQueue = currentQueue.filter(m => m.id !== messageId);
    saveQueuedMessages(newQueue);
    setQueue(prev => prev.filter(m => m.id !== messageId));
  }, []);

  // Check if a message is queued (for optimistic display)
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
