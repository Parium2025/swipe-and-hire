/**
 * TDD Regression — session epoch and cache scope.
 *
 * P1-1 session epoch: a handleChange retained from A session 1 must stay inert
 *      after A -> logout -> A session 2. It may not mutate visible content,
 *      localStorage (clean/pending journal), schedule a timer or reach the DB.
 *      The new session's own handleChange must still work.
 * P1-2 cachePrefix scope: changing `cachePrefix` for the SAME user is a real
 *      scope transition. Old callbacks/wakes become inert, the new config
 *      hydrates and writes only the new keys, and the old journal is never
 *      relabelled or drained through the new scope.
 *
 * A single QueryClient/wrapper instance is reused across explicit rerenders so
 * cache behaviour is never masked by a fresh client.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const OLD_PREFIX = 'jobseeker_notes_cache_old';
const NEW_PREFIX = 'jobseeker_notes_cache_new';
const SAVE_DEBOUNCE_MS = 1200;

let mockUser: { id: string } | null = null;
const upserts: Array<{ owner: string | null; content: string }> = [];

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

let online = true;
const connectivityListeners: Array<(online: boolean) => void> = [];
vi.mock('@/lib/connectivityManager', () => ({
  getIsOnline: () => online,
  onConnectivityChange: (cb: (o: boolean) => void) => {
    connectivityListeners.push(cb);
    return () => {
      const i = connectivityListeners.indexOf(cb);
      if (i >= 0) connectivityListeners.splice(i, 1);
    };
  },
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

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({
      data: mockUser ? { id: `row-${mockUser.id}`, content: `${mockUser.id.toUpperCase()} SERVER` } : null,
      error: null as null,
    }),
    upsert: async (row: Record<string, string>) => {
      upserts.push({ owner: row.user_id ?? null, content: row.content ?? '' });
      return { error: null as null };
    },
  };
  return {
    supabase: {
      from: () => builder,
      removeChannel: () => {},
      auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  };
});

import { useNotesSync } from '@/hooks/useNotesSync';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function renderNotes(initialPrefix: string) {
  // ONE QueryClient for the whole scenario, including every rerender.
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

async function flushDebounce() {
  await act(async () => {
    await sleep(SAVE_DEBOUNCE_MS + 250);
  });
}

describe('useNotesSync — session epoch and cache scope', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser = null;
    online = true;
    upserts.length = 0;
    connectivityListeners.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    connectivityListeners.length = 0;
  });

  it('P1-1: a handleChange from A session 1 is fully inert in A session 2', async () => {
    mockUser = { id: 'a' };
    const { result, rerender } = renderNotes(OLD_PREFIX);
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));
    const session1Handle = result.current.handleChange;

    // logout
    mockUser = null;
    rerender({ prefix: OLD_PREFIX });
    expect(result.current.content).toBe('');

    // re-login as the same account → a NEW session
    mockUser = { id: 'a' };
    rerender({ prefix: OLD_PREFIX });
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));
    upserts.length = 0;

    act(() => {
      session1Handle('SESSION 1 STALE TEXT');
    });

    expect(result.current.content).toBe('A SERVER');
    expect(result.current.saveFailed).toBe(false);
    expect(localStorage.getItem(`${OLD_PREFIX}_a__pending`)).toBeNull();

    await flushDebounce();

    expect(upserts).toEqual([]);
    expect(result.current.isSaving).toBe(false);

    // The current session's own handle still works and saves as owner A.
    act(() => {
      result.current.handleChange('SESSION 2 EDIT');
    });
    await flushDebounce();
    expect(upserts).toContainEqual({ owner: 'a', content: 'SESSION 2 EDIT' });
  });

  it('P1-2: changing cachePrefix for the same user is a real scope transition', async () => {
    mockUser = { id: 'a' };
    online = false; // keep the old journal intact
    localStorage.setItem(
      `${OLD_PREFIX}_a__pending`,
      JSON.stringify({ v: 1, u: 'a', c: 'OLD SCOPE JOURNAL', t: Date.now() })
    );
    localStorage.setItem(`${NEW_PREFIX}_a`, 'NEW SCOPE CLEAN');

    const { result, rerender } = renderNotes(OLD_PREFIX);
    await waitFor(() => expect(result.current.content).toBe('OLD SCOPE JOURNAL'));
    const oldScopeHandle = result.current.handleChange;

    // Same user, new scope.
    rerender({ prefix: NEW_PREFIX });

    // Hydration comes from the NEW keys only.
    await waitFor(() => expect(result.current.content).toBe('NEW SCOPE CLEAN'));
    upserts.length = 0;

    // The retained old-scope handle is inert.
    act(() => {
      oldScopeHandle('OLD SCOPE INJECTED');
    });
    // The new scope hydrates from its own cache and then reconciles with its
    // own server request — never with old-scope content or the stale handle.
    expect(['NEW SCOPE CLEAN', 'A SERVER']).toContain(result.current.content);
    expect(result.current.content).not.toBe('OLD SCOPE INJECTED');
    expect(result.current.content).not.toBe('OLD SCOPE JOURNAL');
    expect(localStorage.getItem(`${OLD_PREFIX}_a__pending`)).toContain('OLD SCOPE JOURNAL');
    expect(localStorage.getItem(`${OLD_PREFIX}_a__pending`)).not.toContain('OLD SCOPE INJECTED');
    expect(localStorage.getItem(`${NEW_PREFIX}_a__pending`)).toBeNull();

    // A current edit uses ONLY the new keys and upserts the same user.
    online = true;
    act(() => {
      result.current.handleChange('NEW SCOPE EDIT');
    });
    expect(localStorage.getItem(`${NEW_PREFIX}_a__pending`)).toContain('NEW SCOPE EDIT');
    await flushDebounce();

    expect(upserts).toContainEqual({ owner: 'a', content: 'NEW SCOPE EDIT' });
    expect(upserts.some((u) => u.content.includes('OLD SCOPE'))).toBe(false);
    expect(localStorage.getItem(`${NEW_PREFIX}_a`)).toBe('NEW SCOPE EDIT');
  });

  it('P1-2: old-scope wakes and unload after a scope transition never revive the old scope', async () => {
    mockUser = { id: 'a' };
    online = false;
    localStorage.setItem(
      `${OLD_PREFIX}_a__pending`,
      JSON.stringify({ v: 1, u: 'a', c: 'OLD SCOPE JOURNAL', t: Date.now() })
    );

    const { result, rerender } = renderNotes(OLD_PREFIX);
    await waitFor(() => expect(result.current.content).toBe('OLD SCOPE JOURNAL'));
    const oldScopeWakes = [...connectivityListeners];
    expect(oldScopeWakes.length).toBeGreaterThan(0);

    rerender({ prefix: NEW_PREFIX });
    await waitFor(() => expect(result.current.content).not.toBe('OLD SCOPE JOURNAL'));
    upserts.length = 0;

    online = true;
    await act(async () => {
      for (const w of oldScopeWakes) w(true);
      window.dispatchEvent(new Event('beforeunload'));
      await sleep(50);
    });
    await flushDebounce();

    expect(upserts.some((u) => u.content.includes('OLD SCOPE JOURNAL'))).toBe(false);
    expect(localStorage.getItem(`${OLD_PREFIX}_a__pending`)).toContain('OLD SCOPE JOURNAL');
  });
});
