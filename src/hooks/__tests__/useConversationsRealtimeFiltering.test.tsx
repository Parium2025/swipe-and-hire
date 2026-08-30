/**
 * RED → GREEN: useConversations får ALDRIG registrera en ofiltrerad
 * conversation_messages-prenumeration. Vid 0 id:n ska ingen meddelandebindning
 * skapas alls, och över 100 id:n ska filtret shardas i chunkar om 100 istället
 * för att falla tillbaka på en global kanal (O(klienter × meddelanden)).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Registration {
  channel: string;
  table: string;
  event: string;
  filter?: string;
  callback: (payload: Record<string, unknown>) => void;
}

const registrations: Registration[] = [];
const subscribedChannels: string[] = [];
const removedChannels: string[] = [];

interface MockChannel {
  name: string;
  on: (
    event: string,
    opts: Record<string, unknown>,
    cb: (payload: Record<string, unknown>) => void,
  ) => MockChannel;
  subscribe: () => MockChannel;
}

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: (name: string): MockChannel => {
    const channel: MockChannel = {
      name,
      on: (event, opts, cb) => {
        registrations.push({
          channel: name,
          table: String(opts?.table ?? ''),
          event: String(opts?.event ?? event),
          filter: opts?.filter as string | undefined,
          callback: cb,
        });
        return channel;
      },
      subscribe: () => {
        subscribedChannels.push(name);
        return channel;
      },
    };
    return channel;
  },
}));

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const key of ['select', 'order', 'eq', 'in', 'is', 'neq', 'not', 'gte', 'lte']) {
    builder[key] = vi.fn(chain);
  }
  builder.limit = vi.fn(async () => ({ data: [], error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.then = undefined;
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    removeChannel: vi.fn((channel: MockChannel) => {
      removedChannels.push(channel?.name);
    }),
    from: vi.fn(() => makeBuilder()),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}));

const USER_ID = 'user-conv-1';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: USER_ID }, userRole: { role: 'job_seeker' } }),
}));

vi.mock('@/lib/performanceGuards', () => ({
  fetchCachedProfile: vi.fn(async () => null),
  fetchCachedProfiles: vi.fn(async () => new Map()),
  rateLimited: vi.fn(async (_k: string, fn: () => unknown) => fn()),
}));

vi.mock('@/hooks/useMediaUrl', () => ({
  prefetchMediaUrl: vi.fn(async () => undefined),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { useConversations } from '@/hooks/useConversations';

function Harness() {
  useConversations();
  return null;
}

function makeConversations(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `conv-${String(i).padStart(4, '0')}`,
    name: null,
    is_group: false,
    job_id: null,
    application_id: null,
    candidate_id: null,
    created_by: USER_ID,
    created_at: '2026-01-01T00:00:00.000Z',
    last_message_at: '2026-01-01T00:00:00.000Z',
    members: [{ user_id: USER_ID, is_admin: false, last_read_at: null }],
    unread_count: 0,
  }));
}

let client: QueryClient;

function renderWith(count: number) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  if (count > 0) {
    client.setQueryData(['conversations', USER_ID], makeConversations(count));
  }
  const utils = render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  return utils;
}

function messageBindings() {
  return registrations.filter((r) => r.table === 'conversation_messages');
}

beforeEach(() => {
  registrations.length = 0;
  subscribedChannels.length = 0;
  removedChannels.length = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useConversations realtime-filtrering', () => {
  it('0 id:n → ingen conversation_messages-bindning, men medlemskanal kvar', () => {
    renderWith(0);

    expect(messageBindings()).toHaveLength(0);
    expect(subscribedChannels).toHaveLength(1);

    const memberBindings = registrations.filter((r) => r.table === 'conversation_members');
    const events = memberBindings.map((r) => r.event).sort();
    expect(events).toEqual(['DELETE', 'INSERT', 'UPDATE']);
    for (const binding of memberBindings) {
      expect(binding.filter).toBe(`user_id=eq.${USER_ID}`);
    }

    const insert = memberBindings.find((r) => r.event === 'INSERT')!;
    const spy = vi.spyOn(client, 'invalidateQueries');
    act(() => {
      insert.callback({ new: { conversation_id: 'conv-new', user_id: USER_ID } });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['conversations', USER_ID] });
  });

  it.each([1, 100, 101, 200, 201])('%i id:n → ceil(n/100) filtrerade shards', (count) => {
    renderWith(count);

    const bindings = messageBindings();
    expect(bindings).toHaveLength(Math.ceil(count / 100));

    const flattened: string[] = [];
    for (const binding of bindings) {
      expect(binding.event).toBe('INSERT');
      expect(binding.filter).toBeTruthy();
      const match = /^conversation_id=in\.\(([^)]+)\)$/.exec(binding.filter as string);
      expect(match).toBeTruthy();
      const ids = (match as RegExpExecArray)[1].split(',');
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.length).toBeLessThanOrEqual(100);
      flattened.push(...ids);
    }

    const expected = makeConversations(count).map((c) => c.id).sort();
    expect(flattened).toEqual(expected);
    expect(new Set(flattened).size).toBe(flattened.length);
  });

  it('meddelande från shard 2 patchar last_message och unread', () => {
    renderWith(101);
    const bindings = messageBindings();
    expect(bindings).toHaveLength(2);

    const lastId = `conv-${String(100).padStart(4, '0')}`;
    expect(bindings[1].filter).toContain(lastId);

    act(() => {
      bindings[1].callback({
        new: {
          id: 'msg-1',
          conversation_id: lastId,
          sender_id: 'someone-else',
          content: 'hej',
          created_at: '2026-02-01T00:00:00.000Z',
        },
      });
    });

    const data = client.getQueryData<Array<{ id: string; unread_count: number; last_message?: { id: string } }>>([
      'conversations',
      USER_ID,
    ]);
    const target = data?.find((c) => c.id === lastId);
    expect(target?.last_message?.id).toBe('msg-1');
    expect(target?.unread_count).toBe(1);
  });

  it('ändrad id-mängd byter kanal en gång; unmount städar kanal och timers', async () => {
    const { unmount } = renderWith(1);
    // Låt den initiala queryFn hinna settla innan id-mängden ändras.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const firstChannel = subscribedChannels[0];

    await act(async () => {
      client.setQueryData(['conversations', USER_ID], makeConversations(2));
      await Promise.resolve();
    });

    expect(removedChannels).toEqual([firstChannel]);
    expect(subscribedChannels).toHaveLength(2);


    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    unmount();
    expect(removedChannels).toHaveLength(2);
    expect(clearSpy).toHaveBeenCalled();
  });
});
