import { describe, it, expect, beforeEach, vi } from 'vitest';

// ═══════════════════════════════════════════════
// Offline message queue localStorage logic
// These test the pure functions without React hooks
// ═══════════════════════════════════════════════

const QUEUE_KEY = 'parium_offline_message_queue';

interface QueuedMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  job_id: string | null;
  application_id?: string | null;
  created_at: string;
  attempts: number;
}

// Re-implement the validation function to test it
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
  localStorage.setItem(QUEUE_KEY, JSON.stringify(messages));
}

beforeEach(() => {
  localStorage.clear();
});

describe('isValidQueuedMessage', () => {
  it('validates a complete message', () => {
    expect(isValidQueuedMessage({
      id: 'offline-123',
      sender_id: 'user-1',
      recipient_id: 'user-2',
      content: 'Hej!',
      job_id: 'job-1',
      created_at: '2026-03-15T10:00:00Z',
      attempts: 0,
    })).toBe(true);
  });

  it('rejects incomplete message - missing content', () => {
    expect(isValidQueuedMessage({
      id: 'offline-123',
      sender_id: 'user-1',
      recipient_id: 'user-2',
      created_at: '2026-03-15T10:00:00Z',
      attempts: 0,
    })).toBe(false);
  });

  it('rejects non-object values', () => {
    expect(isValidQueuedMessage(null)).toBe(false);
    expect(isValidQueuedMessage(undefined)).toBe(false);
    expect(isValidQueuedMessage('string')).toBe(false);
    expect(isValidQueuedMessage(42)).toBe(false);
  });

  it('rejects wrong types for fields', () => {
    expect(isValidQueuedMessage({
      id: 123, // should be string
      sender_id: 'user-1',
      recipient_id: 'user-2',
      content: 'Hej',
      created_at: '2026-03-15',
      attempts: 0,
    })).toBe(false);
  });

  it('rejects non-number attempts', () => {
    expect(isValidQueuedMessage({
      id: 'offline-123',
      sender_id: 'user-1',
      recipient_id: 'user-2',
      content: 'Hej',
      created_at: '2026-03-15',
      attempts: '0', // should be number
    })).toBe(false);
  });
});

describe('getQueuedMessages', () => {
  it('returns empty array when no queue exists', () => {
    expect(getQueuedMessages()).toEqual([]);
  });

  it('returns valid messages from localStorage', () => {
    const msg: QueuedMessage = {
      id: 'offline-1',
      sender_id: 'user-a',
      recipient_id: 'user-b',
      content: 'Hej!',
      job_id: null,
      created_at: '2026-03-15T10:00:00Z',
      attempts: 0,
    };
    localStorage.setItem(QUEUE_KEY, JSON.stringify([msg]));
    
    const result = getQueuedMessages();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('offline-1');
    expect(result[0].content).toBe('Hej!');
  });

  it('filters out invalid entries from queue', () => {
    const validMsg = {
      id: 'offline-1',
      sender_id: 'user-a',
      recipient_id: 'user-b',
      content: 'Valid',
      job_id: null,
      created_at: '2026-03-15T10:00:00Z',
      attempts: 0,
    };
    const invalidMsg = { id: 123, broken: true };
    localStorage.setItem(QUEUE_KEY, JSON.stringify([validMsg, invalidMsg]));
    
    const result = getQueuedMessages();
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Valid');
  });

  it('handles corrupted localStorage data gracefully', () => {
    localStorage.setItem(QUEUE_KEY, 'not-valid-json{{{');
    expect(getQueuedMessages()).toEqual([]);
    // Corrupted data should be removed
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('handles non-array JSON gracefully', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify({ not: 'an array' }));
    expect(getQueuedMessages()).toEqual([]);
  });
});

describe('saveQueuedMessages', () => {
  it('saves messages to localStorage', () => {
    const messages: QueuedMessage[] = [
      {
        id: 'offline-1',
        sender_id: 'user-a',
        recipient_id: 'user-b',
        content: 'Test',
        job_id: 'job-1',
        created_at: '2026-03-15T10:00:00Z',
        attempts: 0,
      },
    ];
    
    saveQueuedMessages(messages);
    
    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].content).toBe('Test');
    expect(stored[0].recipient_id).toBe('user-b');
  });

  it('overwrites existing queue', () => {
    saveQueuedMessages([{
      id: 'old',
      sender_id: 'u1',
      recipient_id: 'u2',
      content: 'Old',
      job_id: null,
      created_at: '2026-03-15T10:00:00Z',
      attempts: 0,
    }]);

    saveQueuedMessages([{
      id: 'new',
      sender_id: 'u1',
      recipient_id: 'u3',
      content: 'New',
      job_id: null,
      created_at: '2026-03-15T11:00:00Z',
      attempts: 0,
    }]);

    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('new');
    expect(stored[0].recipient_id).toBe('u3');
  });
});

describe('message routing correctness', () => {
  it('preserves recipient_id through queue cycle (message goes to right person)', () => {
    const recipientA = 'candidate-abc-123';
    const recipientB = 'candidate-xyz-789';
    
    const messages: QueuedMessage[] = [
      {
        id: 'offline-1',
        sender_id: 'employer-1',
        recipient_id: recipientA,
        content: 'Hej kandidat A!',
        job_id: 'job-1',
        application_id: 'app-1',
        created_at: '2026-03-15T10:00:00Z',
        attempts: 0,
      },
      {
        id: 'offline-2',
        sender_id: 'employer-1',
        recipient_id: recipientB,
        content: 'Hej kandidat B!',
        job_id: 'job-2',
        application_id: 'app-2',
        created_at: '2026-03-15T10:01:00Z',
        attempts: 0,
      },
    ];
    
    saveQueuedMessages(messages);
    const restored = getQueuedMessages();
    
    // Verify each message is linked to the correct recipient
    expect(restored[0].recipient_id).toBe(recipientA);
    expect(restored[0].content).toBe('Hej kandidat A!');
    expect(restored[0].job_id).toBe('job-1');
    
    expect(restored[1].recipient_id).toBe(recipientB);
    expect(restored[1].content).toBe('Hej kandidat B!');
    expect(restored[1].job_id).toBe('job-2');
  });

  it('correctly filters messages by sender_id', () => {
    const messages: QueuedMessage[] = [
      {
        id: 'offline-1',
        sender_id: 'employer-1',
        recipient_id: 'candidate-1',
        content: 'From employer 1',
        job_id: null,
        created_at: '2026-03-15T10:00:00Z',
        attempts: 0,
      },
      {
        id: 'offline-2',
        sender_id: 'employer-2',
        recipient_id: 'candidate-2',
        content: 'From employer 2',
        job_id: null,
        created_at: '2026-03-15T10:01:00Z',
        attempts: 0,
      },
    ];
    
    saveQueuedMessages(messages);
    const all = getQueuedMessages();
    
    // Filter like the hook does
    const employer1Queue = all.filter(m => m.sender_id === 'employer-1');
    const employer2Queue = all.filter(m => m.sender_id === 'employer-2');
    
    expect(employer1Queue).toHaveLength(1);
    expect(employer1Queue[0].content).toBe('From employer 1');
    
    expect(employer2Queue).toHaveLength(1);
    expect(employer2Queue[0].content).toBe('From employer 2');
  });

  it('tracks retry attempts correctly', () => {
    const msg: QueuedMessage = {
      id: 'offline-1',
      sender_id: 'u1',
      recipient_id: 'u2',
      content: 'Retry me',
      job_id: null,
      created_at: '2026-03-15T10:00:00Z',
      attempts: 0,
    };
    
    // Simulate 3 retry attempts
    msg.attempts = 1;
    saveQueuedMessages([msg]);
    expect(getQueuedMessages()[0].attempts).toBe(1);
    
    msg.attempts = 2;
    saveQueuedMessages([msg]);
    expect(getQueuedMessages()[0].attempts).toBe(2);
    
    msg.attempts = 3;
    saveQueuedMessages([msg]);
    // At attempts >= 3 (MAX_ATTEMPTS), the hook drops the message
    const stored = getQueuedMessages();
    expect(stored[0].attempts).toBe(3);
  });
});
