import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

// Get queued messages from localStorage
function getQueuedMessages(): QueuedMessage[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save queued messages to localStorage
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

      if (error) throw error;
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
        // Increment attempts
        const updatedMessage = { ...message, attempts: message.attempts + 1 };
        if (updatedMessage.attempts < MAX_ATTEMPTS) {
          remaining.push(updatedMessage);
        } else {
          console.warn('Message exceeded max attempts, dropping:', message.id);
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

  // Auto-sync when coming back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('Back online - syncing message queue...');
      syncQueue();
    };

    window.addEventListener('online', handleOnline);
    
    // Also try to sync on mount if online
    if (navigator.onLine && queue.length > 0) {
      syncQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
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
