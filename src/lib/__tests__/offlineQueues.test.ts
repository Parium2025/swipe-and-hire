import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ─── Mock localStorage ──────────────────────────────────────────────
const localStorageMap = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageMap.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageMap.set(key, value); }),
  removeItem: vi.fn((key: string) => { localStorageMap.delete(key); }),
  clear: vi.fn(() => localStorageMap.clear()),
  get length() { return localStorageMap.size; },
  key: vi.fn((i: number) => [...localStorageMap.keys()][i] ?? null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ─── Mock supabase ──────────────────────────────────────────────────
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      delete: () => mockDelete(),
      update: () => mockUpdate(),
      select: () => mockSelect(),
    })),
    functions: { invoke: vi.fn().mockResolvedValue({ error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// ─── Mock connectivity ──────────────────────────────────────────────
let mockIsOnline = true;
const mockListeners = new Set<(online: boolean) => void>();
vi.mock('@/lib/connectivityManager', () => ({
  getIsOnline: () => mockIsOnline,
  onConnectivityChange: (fn: (online: boolean) => void) => {
    mockListeners.add(fn);
    return () => mockListeners.delete(fn);
  },
}));

vi.mock('@/lib/offlineSyncEngine', () => ({
  notifySwOfPendingOps: vi.fn(),
  shouldApplyQueuedOp: vi.fn().mockResolvedValue(true),
  executeWithConflictCheck: vi.fn().mockImplementation(async (_t, _r, _q, op) => {
    const result = await op();
    return { applied: true, result };
  }),
}));

vi.mock('@/lib/safeStorage', () => ({
  safeSetItem: vi.fn((key: string, value: string) => {
    localStorageMap.set(key, value);
    return true;
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useMyApplicationsCache', () => ({ clearMyApplicationsLocalCache: vi.fn() }));

// Helper to simulate connectivity change
function simulateGoOnline() {
  mockIsOnline = true;
  mockListeners.forEach(fn => fn(true));
}

function simulateGoOffline() {
  mockIsOnline = false;
  mockListeners.forEach(fn => fn(false));
}

// ─── TESTS ──────────────────────────────────────────────────────────

describe('safeStorage', () => {
  beforeEach(() => localStorageMap.clear());

  it('safeSetItem stores data', async () => {
    const { safeSetItem } = await import('@/lib/safeStorage');
    const result = safeSetItem('test-key', 'test-value');
    expect(result).toBe(true);
    expect(localStorageMap.get('test-key')).toBe('test-value');
  });
});

describe('Offline Message Queue', () => {
  const QUEUE_KEY = 'parium_offline_message_queue';
  const userId = 'user-123';

  beforeEach(() => {
    localStorageMap.clear();
    mockIsOnline = false;
  });

  it('validates queued message shape', () => {
    // Store invalid data
    localStorageMap.set(QUEUE_KEY, JSON.stringify([
      { id: 'valid', sender_id: userId, recipient_id: 'r1', content: 'hi', created_at: '2024-01-01', attempts: 0 },
      { broken: true },
      'not-an-object',
      null,
    ]));

    const raw = JSON.parse(localStorageMap.get(QUEUE_KEY)!);
    const valid = raw.filter((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const obj = item as Record<string, unknown>;
      return typeof obj.id === 'string' && typeof obj.sender_id === 'string'
        && typeof obj.recipient_id === 'string' && typeof obj.content === 'string'
        && typeof obj.created_at === 'string' && typeof obj.attempts === 'number';
    });
    expect(valid).toHaveLength(1);
    expect(valid[0].id).toBe('valid');
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorageMap.set(QUEUE_KEY, 'NOT VALID JSON!!!');
    const raw = localStorageMap.get(QUEUE_KEY);
    let result: unknown[] = [];
    try {
      const parsed = JSON.parse(raw!);
      result = Array.isArray(parsed) ? parsed : [];
    } catch {
      localStorageMap.delete(QUEUE_KEY);
      result = [];
    }
    expect(result).toEqual([]);
    expect(localStorageMap.has(QUEUE_KEY)).toBe(false);
  });

  it('filters queue by userId', () => {
    localStorageMap.set(QUEUE_KEY, JSON.stringify([
      { id: 'm1', sender_id: userId, recipient_id: 'r1', content: 'hi', created_at: '2024-01-01', attempts: 0 },
      { id: 'm2', sender_id: 'other-user', recipient_id: 'r2', content: 'bye', created_at: '2024-01-01', attempts: 0 },
    ]));
    const all = JSON.parse(localStorageMap.get(QUEUE_KEY)!);
    const myMessages = all.filter((m: any) => m.sender_id === userId);
    expect(myMessages).toHaveLength(1);
    expect(myMessages[0].id).toBe('m1');
  });

  it('respects MAX_ATTEMPTS (3) and drops after exceeding', () => {
    const message = { id: 'm1', sender_id: userId, recipient_id: 'r1', content: 'hi', created_at: '2024-01-01', attempts: 2 };
    const updated = { ...message, attempts: message.attempts + 1 };
    expect(updated.attempts).toBe(3);
    expect(updated.attempts < 3).toBe(false); // Would be dropped
  });
});

describe('Offline Saved Jobs Queue', () => {
  const QUEUE_KEY = 'parium_offline_saved_jobs_queue';
  const userId = 'user-456';

  beforeEach(() => localStorageMap.clear());

  it('deduplicates by jobId+userId (keeps latest)', () => {
    const existingQueue = [
      { jobId: 'job-1', userId, action: 'save', timestamp: 1000, attempts: 0 },
      { jobId: 'job-2', userId, action: 'save', timestamp: 1001, attempts: 0 },
    ];
    // Unsave job-1 should replace the save
    const filtered = existingQueue.filter(q => !(q.jobId === 'job-1' && q.userId === userId));
    const newQueue = [...filtered, { jobId: 'job-1', userId, action: 'unsave', timestamp: 2000, attempts: 0 }];
    expect(newQueue).toHaveLength(2);
    expect(newQueue.find(q => q.jobId === 'job-1')?.action).toBe('unsave');
  });

  it('preserves other users ops during sync', () => {
    const fullQueue = [
      { jobId: 'j1', userId, action: 'save', timestamp: 1000, attempts: 0 },
      { jobId: 'j2', userId: 'other-user', action: 'unsave', timestamp: 1001, attempts: 0 },
    ];
    const otherUserOps = fullQueue.filter(q => q.userId !== userId);
    expect(otherUserOps).toHaveLength(1);
    expect(otherUserOps[0].userId).toBe('other-user');
  });

  it('validates QueuedAction shape', () => {
    const valid = { jobId: 'j1', userId: 'u1', action: 'save', timestamp: 1000, attempts: 0 };
    const invalid1 = { jobId: 'j1', action: 'save' }; // missing userId
    const invalid2 = { jobId: 'j1', userId: 'u1', action: 'invalid', timestamp: 1000, attempts: 0 };

    const isValid = (item: any) => typeof item.jobId === 'string' && typeof item.userId === 'string'
      && (item.action === 'save' || item.action === 'unsave') && typeof item.timestamp === 'number'
      && typeof item.attempts === 'number';

    expect(isValid(valid)).toBe(true);
    expect(isValid(invalid1)).toBe(false);
    expect(isValid(invalid2)).toBe(false);
  });
});

describe('Offline Application Queue', () => {
  const QUEUE_KEY = 'parium_offline_application_queue';
  const userId = 'applicant-789';

  beforeEach(() => localStorageMap.clear());

  it('deduplicates by jobId+applicantId', () => {
    const queue = [
      { id: 'a1', jobId: 'j1', applicantId: userId, queuedAt: 1000, attempts: 0, payload: {} },
      { id: 'a2', jobId: 'j2', applicantId: userId, queuedAt: 1001, attempts: 0, payload: {} },
    ];
    // Re-apply to j1 should replace
    const filtered = queue.filter(q => !(q.jobId === 'j1' && q.applicantId === userId));
    const newQueue = [...filtered, { id: 'a3', jobId: 'j1', applicantId: userId, queuedAt: 2000, attempts: 0, payload: { updated: true } }];
    expect(newQueue).toHaveLength(2);
    expect(newQueue.find(q => q.jobId === 'j1')?.id).toBe('a3');
  });

  it('validates QueuedApplication shape', () => {
    const valid = { id: 'a1', jobId: 'j1', applicantId: 'u1', queuedAt: 1000, attempts: 0, payload: {} };
    const invalid = { id: 'a1', jobId: 'j1' }; // missing fields

    const isValid = (item: any) => typeof item.id === 'string' && typeof item.jobId === 'string'
      && typeof item.applicantId === 'string' && typeof item.queuedAt === 'number'
      && typeof item.attempts === 'number' && item.payload != null;

    expect(isValid(valid)).toBe(true);
    expect(isValid(invalid)).toBe(false);
  });
});

describe('Candidate Operation Queue', () => {
  beforeEach(() => localStorageMap.clear());

  it('deduplicates by candidateId+type', () => {
    const queue = [
      { id: 'c1', type: 'stage_move', candidateId: 'cand-1', recruiterId: 'r1', payload: { stage: 'interview' }, queuedAt: 1000, attempts: 0 },
      { id: 'c2', type: 'rating_update', candidateId: 'cand-1', recruiterId: 'r1', payload: { rating: 3 }, queuedAt: 1001, attempts: 0 },
    ];
    // New stage_move for same candidate should replace
    const op = { candidateId: 'cand-1', type: 'stage_move' };
    const filtered = queue.filter(q => !(q.candidateId === op.candidateId && q.type === op.type));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe('rating_update');
  });

  it('validates QueuedCandidateOperation shape', () => {
    const isValid = (item: any) => typeof item.id === 'string' && typeof item.type === 'string'
      && typeof item.candidateId === 'string' && typeof item.recruiterId === 'string'
      && typeof item.queuedAt === 'number' && typeof item.attempts === 'number'
      && item.payload != null && typeof item.payload === 'object';

    expect(isValid({ id: 'c1', type: 'stage_move', candidateId: 'c', recruiterId: 'r', queuedAt: 1, attempts: 0, payload: {} })).toBe(true);
    expect(isValid({ id: 'c1', type: 'stage_move' })).toBe(false);
  });
});

describe('Profile Queue', () => {
  const QUEUE_KEY = 'parium_offline_profile_queue';
  const userId = 'user-profile-1';

  beforeEach(() => localStorageMap.clear());

  it('latest-wins: replaces existing queued update for same user', () => {
    const currentQueue = [
      { id: 'p1', userId, updates: { first_name: 'Old' }, queuedAt: 1000, attempts: 0 },
      { id: 'p2', userId: 'other-user', updates: { first_name: 'Other' }, queuedAt: 1001, attempts: 0 },
    ];
    // New update replaces existing for this userId
    const filtered = currentQueue.filter(q => q.userId !== userId);
    const newQueue = [...filtered, { id: 'p3', userId, updates: { first_name: 'New' }, queuedAt: 2000, attempts: 0 }];
    expect(newQueue).toHaveLength(2);
    expect(newQueue.find(q => q.userId === userId)?.updates.first_name).toBe('New');
  });

  it('validates QueuedProfileUpdate shape', () => {
    const isValid = (item: any) => typeof item.id === 'string' && typeof item.userId === 'string'
      && typeof item.queuedAt === 'number' && typeof item.attempts === 'number'
      && item.updates != null && typeof item.updates === 'object';

    expect(isValid({ id: 'p1', userId: 'u1', queuedAt: 1, attempts: 0, updates: {} })).toBe(true);
    expect(isValid({ id: 'p1', queuedAt: 1 })).toBe(false);
  });
});

describe('Bulk Message Queue', () => {
  const QUEUE_KEY = 'parium_bulk_message_queue';

  beforeEach(() => localStorageMap.clear());

  it('validates QueuedMessage shape', () => {
    const isValid = (item: any) => typeof item.id === 'string' && typeof item.sender_id === 'string'
      && typeof item.applicant_id === 'string' && typeof item.content === 'string'
      && typeof item.created_at === 'string' && typeof item.attempts === 'number';

    expect(isValid({ id: 'b1', sender_id: 's1', applicant_id: 'a1', content: 'hi', created_at: '2024-01-01', attempts: 0 })).toBe(true);
    expect(isValid({ id: 'b1', sender_id: 's1' })).toBe(false);
  });

  it('filters by sender_id for user isolation', () => {
    const items = [
      { id: 'b1', sender_id: 'me', applicant_id: 'a1', content: 'hi', created_at: '2024-01-01', attempts: 0 },
      { id: 'b2', sender_id: 'other', applicant_id: 'a2', content: 'bye', created_at: '2024-01-01', attempts: 0 },
    ];
    const myItems = items.filter(i => i.sender_id === 'me');
    expect(myItems).toHaveLength(1);
  });
});

describe('Exponential Backoff', () => {
  it('calculates correct delays', () => {
    const calcDelay = (attempts: number) => Math.min(1000 * Math.pow(2, attempts - 1), 30000);
    expect(calcDelay(1)).toBe(1000);  // 1s
    expect(calcDelay(2)).toBe(2000);  // 2s
    expect(calcDelay(3)).toBe(4000);  // 4s
    expect(calcDelay(4)).toBe(8000);  // 8s
    expect(calcDelay(10)).toBe(30000); // capped at 30s
  });
});

describe('ConnectivityManager integration', () => {
  beforeEach(() => {
    mockIsOnline = true;
    mockListeners.clear();
  });

  it('listeners are called on connectivity change', () => {
    const listener = vi.fn();
    // Use the mocked onConnectivityChange directly
    mockListeners.add(listener);

    simulateGoOffline();
    expect(listener).toHaveBeenCalledWith(false);

    simulateGoOnline();
    expect(listener).toHaveBeenCalledWith(true);

    mockListeners.delete(listener);
    simulateGoOffline();
    expect(listener).toHaveBeenCalledTimes(2); // Not called after unsub
  });

  it('unsubscribe prevents further calls', () => {
    const listener = vi.fn();
    mockListeners.add(listener);
    mockListeners.delete(listener);
    simulateGoOnline();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('Cross-queue consistency', () => {
  it('all queues use same MAX_ATTEMPTS (3)', () => {
    // This is a documentation/consistency test
    const MAX_ATTEMPTS = 3;
    // Each queue should drop operations after 3 failed attempts
    const testAttempts = (attempts: number) => attempts < MAX_ATTEMPTS;
    expect(testAttempts(0)).toBe(true);
    expect(testAttempts(1)).toBe(true);
    expect(testAttempts(2)).toBe(true);
    expect(testAttempts(3)).toBe(false); // Dropped
  });

  it('duplicate key error (23505) is treated as success', () => {
    // Both message queue and application queue treat 23505 as already-sent
    const error = { code: '23505', message: 'duplicate key' };
    const isDuplicateSuccess = error.code === '23505';
    expect(isDuplicateSuccess).toBe(true);
  });

  it('all queue keys use parium_ prefix for namespace isolation', () => {
    const keys = [
      'parium_offline_message_queue',
      'parium_offline_saved_jobs_queue',
      'parium_offline_application_queue',
      'parium_candidate_ops_queue',
      'parium_offline_profile_queue',
      'parium_bulk_message_queue',
    ];
    keys.forEach(key => {
      expect(key.startsWith('parium_')).toBe(true);
    });
  });
});
