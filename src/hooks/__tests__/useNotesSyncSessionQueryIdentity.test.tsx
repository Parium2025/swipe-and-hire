/**
 * TDD Regression — P2: query identity must be bound to the committed SESSION
 * (owner + cache scope + epoch), not only to user + cachePrefix.
 *
 * A -> logout -> A within React Query's 30s staleTime reuses the still-fresh
 * cache entry. The epoch guard correctly rejects that payload, but no new
 * server request is guaranteed. With the scoped storage empty or blocked
 * (private mode / storage failure) the new session then renders empty even
 * though a server note exists.
 *
 * ONE QueryClient is reused across every rerender in a scenario.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const PREFIX = 'jobseeker_notes_cache_session_identity';

let mockUser: { id: string } | null = null;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('@/lib/connectivityManager', () => ({
  getIsOnline: () => true,
  onConnectivityChange: () => () => {},
}));

interface MockChannel {
  on: () => MockChannel;
  subscribe: () => MockChannel;
}
vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: () => {
    const channel: MockChannel = { on: () => channel, subscribe: () => channel };
    return channel;
  },
}));

let responses: Array<{ content: string; delayMs?: number }> = [];
let queryCalls = 0;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => {
      const spec = responses[Math.min(queryCalls, responses.length - 1)] ?? { content: '' };
      queryCalls += 1;
      if (spec.delayMs) await new Promise<void>((r) => setTimeout(r, spec.delayMs));
      return {
        data: {
          id: 'row-a',
          content: spec.content,
          revision: queryCalls - 1,
          updated_at: '2026-08-30T00:00:00.000Z',
        },
        error: null as null,
      };
    },
  };
  return {
    supabase: {
      from: () => builder,
      rpc: async (_fn: string, args: { p_content: string; p_expected_revision: number; p_expected_user_id: string }) => ({
        data: [{
          save_status: 'saved',
          server_content: args.p_content,
          server_revision: args.p_expected_revision + 1,
          server_updated_at: '2026-08-30T00:00:00.000Z',
        }],
        error: null as null,
      }),
      removeChannel: () => {},
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'TOKEN-1' } } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
    },
  };
});

import { useNotesSync } from '@/hooks/useNotesSync';

function renderNotes() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      useNotesSync({
        table: 'jobseeker_notes',
        ownerColumn: 'user_id',
        cachePrefix: PREFIX,
        queryKey: 'jobseeker-note',
      }),
    { wrapper }
  );
}

describe('useNotesSync — session-bound query identity (A -> logout -> A)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser = { id: 'a' };
    queryCalls = 0;
    responses = [{ content: 'SERVER V1' }];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('re-login of the SAME user inside staleTime starts a NEW server request and shows the new payload', async () => {
    responses = [{ content: 'SERVER V1' }, { content: 'SERVER V2' }];
    const { result, rerender } = renderNotes();

    await waitFor(() => expect(result.current.content).toBe('SERVER V1'));
    expect(queryCalls).toBe(1);

    // Logout.
    mockUser = null;
    rerender();
    await act(async () => {
      await sleep(20);
    });
    expect(result.current.content).toBe('');

    // Scoped storage is empty/blocked for the new session (private mode).
    localStorage.clear();
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    // Re-login as the SAME user, well inside the 30s staleTime.
    mockUser = { id: 'a' };
    rerender();

    await waitFor(() => expect(queryCalls).toBe(2));
    await waitFor(() => expect(result.current.content).toBe('SERVER V2'));
    getItemSpy.mockRestore();
  });

  it('a delayed payload from the PREVIOUS session is never applied to the new session', async () => {
    responses = [
      { content: 'OLD SESSION PAYLOAD', delayMs: 400 },
      { content: 'NEW SESSION PAYLOAD' },
    ];
    const { result, rerender } = renderNotes();

    await act(async () => {
      await sleep(20);
    });

    mockUser = null;
    rerender();
    await act(async () => {
      await sleep(20);
    });

    mockUser = { id: 'a' };
    rerender();

    await waitFor(() => expect(result.current.content).toBe('NEW SESSION PAYLOAD'));

    // Let the delayed old-session request land.
    await act(async () => {
      await sleep(600);
    });

    expect(result.current.content).toBe('NEW SESSION PAYLOAD');
    expect(localStorage.getItem(`${PREFIX}_a`)).toBe('NEW SESSION PAYLOAD');
  });
});
