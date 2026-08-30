/**
 * TDD Regression — P2 contract gaps at a SAME-USER cachePrefix (scope) change.
 *
 * A) Keepalive flush: the layout transition clears `accessTokenRef`, but the
 *    token effect must re-arm for the new scope. Otherwise the beforeunload
 *    keepalive POST is silently disabled after a scope change. A retained
 *    auth callback from the old scope must not be able to inject a stale
 *    token or revive old content.
 * B) Server reconciliation: the query identity must include the cache scope so
 *    a same-user scope change starts its own request. A delayed OLD payload may
 *    never be applied to the new scope's cache/visible content.
 *
 * ONE QueryClient is reused across every rerender in a scenario.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const OLD_PREFIX = 'jobseeker_notes_cache_scope_a';
const NEW_PREFIX = 'jobseeker_notes_cache_scope_b';

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

/** Server responses, consumed in order; each entry may delay. */
let responses: Array<{ content: string; delayMs?: number }> = [];
let queryCalls = 0;
let currentToken: string | null = 'TOKEN-1';
const authCallbacks: Array<(event: string, session: { access_token: string } | null) => void> = [];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => {
      const spec = responses[Math.min(queryCalls, responses.length - 1)] ?? { content: '' };
      queryCalls += 1;
      if (spec.delayMs) await new Promise<void>((r) => setTimeout(r, spec.delayMs));
      return { data: { id: 'row-a', content: spec.content }, error: null as null };
    },
    upsert: async () => ({ error: null as null }),
  };
  return {
    supabase: {
      from: () => builder,
      removeChannel: () => {},
      auth: {
        getSession: async () => ({
          data: { session: currentToken ? { access_token: currentToken } : null },
        }),
        onAuthStateChange: (cb: (event: string, session: { access_token: string } | null) => void) => {
          authCallbacks.push(cb);
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  const i = authCallbacks.indexOf(cb);
                  if (i >= 0) authCallbacks.splice(i, 1);
                },
              },
            },
          };
        },
      },
    },
  };
});

import { useNotesSync } from '@/hooks/useNotesSync';

function renderNotes(initialPrefix: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    ({ prefix }: { prefix: string }) =>
      useNotesSync({
        table: 'jobseeker_notes',
        ownerColumn: 'user_id',
        cachePrefix: prefix,
        queryKey: 'jobseeker-note',
      }),
    { wrapper, initialProps: { prefix: initialPrefix } }
  );
}

describe('useNotesSync — scope-bound auth token and server reconciliation', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    mockUser = { id: 'a' };
    queryCalls = 0;
    responses = [{ content: 'SERVER V1' }];
    currentToken = 'TOKEN-1';
    authCallbacks.length = 0;
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(null, { status: 204 })) as never;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    authCallbacks.length = 0;
  });

  it('A: beforeunload keepalive still fires with the current token after a same-user scope change', async () => {
    responses = [{ content: 'SERVER V1' }, { content: 'SERVER V2' }];
    const { result, rerender } = renderNotes(OLD_PREFIX);
    await waitFor(() => expect(result.current.content).toBe('SERVER V1'));
    const staleAuthCallback = authCallbacks[0];
    expect(staleAuthCallback).toBeTypeOf('function');

    // Same user, new cache scope.
    rerender({ prefix: NEW_PREFIX });
    await act(async () => {
      await sleep(20);
    });

    // A retained OLD-scope auth callback must not be able to inject a token.
    act(() => {
      staleAuthCallback('TOKEN_REFRESHED', { access_token: 'STALE-TOKEN' });
    });

    act(() => {
      result.current.handleChange('NEW SCOPE UNSAVED');
    });
    expect(localStorage.getItem(`${NEW_PREFIX}_a__pending`)).toContain('NEW SCOPE UNSAVED');

    fetchSpy.mockClear();
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TOKEN-1');
    expect(init.keepalive).toBe(true);
    const body = JSON.parse(init.body as string) as { user_id: string; content: string };
    expect(body.user_id).toBe('a');
    expect(body.content).toBe('NEW SCOPE UNSAVED');
  });

  it('B: a same-user scope change starts its own server request bound to the new scope', async () => {
    responses = [{ content: 'SERVER V1' }, { content: 'SERVER V2' }];
    const { result, rerender } = renderNotes(OLD_PREFIX);
    await waitFor(() => expect(result.current.content).toBe('SERVER V1'));
    expect(queryCalls).toBe(1);
    expect(localStorage.getItem(`${OLD_PREFIX}_a`)).toBe('SERVER V1');

    rerender({ prefix: NEW_PREFIX });

    await waitFor(() => expect(queryCalls).toBe(2));
    await waitFor(() => expect(result.current.content).toBe('SERVER V2'));
    expect(localStorage.getItem(`${NEW_PREFIX}_a`)).toBe('SERVER V2');
    // The old scope's cache is untouched by the new reconciliation.
    expect(localStorage.getItem(`${OLD_PREFIX}_a`)).toBe('SERVER V1');
    expect(localStorage.getItem(`${OLD_PREFIX}_a__pending`)).toBeNull();
  });

  it('B: a delayed OLD-scope payload is never applied to the new scope', async () => {
    responses = [
      { content: 'OLD SERVER PAYLOAD', delayMs: 400 },
      { content: 'NEW SERVER PAYLOAD' },
    ];
    const { result, rerender } = renderNotes(OLD_PREFIX);

    // Switch scope before the first (delayed) request can resolve.
    await act(async () => {
      await sleep(20);
    });
    rerender({ prefix: NEW_PREFIX });

    await waitFor(() => expect(result.current.content).toBe('NEW SERVER PAYLOAD'));

    // Let the delayed old request land.
    await act(async () => {
      await sleep(600);
    });

    expect(result.current.content).toBe('NEW SERVER PAYLOAD');
    expect(localStorage.getItem(`${NEW_PREFIX}_a`)).toBe('NEW SERVER PAYLOAD');
    expect(localStorage.getItem(`${NEW_PREFIX}_a`)).not.toBe('OLD SERVER PAYLOAD');
  });
});
