/**
 * TDD Regression — cross-account save paths.
 *
 * P1-1: a retained handleChange created under account A must not mutate shared
 *       dirty/content/status/journal state or schedule a save once the
 *       committed identity is B (or logged out).
 * P1-2: a save wake (debounce timer / connectivity callback) created under A
 *       must stay A-scoped forever. It may never execute with B's owner
 *       configuration, so A's text can never be upserted as B's note.
 *
 * Every upsert is recorded with its owner column value, so the assertions are
 * about real write attempts, not about source strings.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const PREFIX = 'jobseeker_notes_cache';
const SAVE_DEBOUNCE_MS = 1200;

let mockUser: { id: string } | null = null;

/** Every upsert attempt reaching the backend mock. */
const upserts: Array<{ owner: string | null; content: string }> = [];

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

let online = true;
const connectivityListeners: Array<(online: boolean) => void> = [];
vi.mock('@/lib/connectivityManager', () => ({
  getIsOnline: () => online,
  onConnectivityChange: (cb: (online: boolean) => void) => {
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
    const channel: MockChannel = {
      on: () => channel,
      subscribe: () => channel,
    };
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

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function renderNotes() {
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

/** Lets any pending debounce fire and its drain settle. */
async function flushDebounce() {
  await act(async () => {
    await sleep(SAVE_DEBOUNCE_MS + 250);
  });
}

describe('useNotesSync — cross-account save paths', () => {
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

  it('P1-1: a retained A handleChange is inert after switching A -> B', async () => {
    mockUser = { id: 'a' };
    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));
    const staleHandleA = result.current.handleChange;

    mockUser = { id: 'b' };
    rerender();
    await waitFor(() => expect(result.current.content).toBe('B SERVER'));
    upserts.length = 0;

    act(() => {
      staleHandleA('A INJECTED');
    });

    // No visible state change for B, and no journal written for either account.
    expect(result.current.content).toBe('B SERVER');
    expect(result.current.saveFailed).toBe(false);
    expect(localStorage.getItem(`${PREFIX}_b__pending`)).toBeNull();
    expect(localStorage.getItem(`${PREFIX}_a__pending`)).toBeNull();

    await flushDebounce();

    expect(result.current.isSaving).toBe(false);
    expect(upserts).toEqual([]);
  });

  it('P1-1: a retained A handleChange is inert after logout (A -> null)', async () => {
    mockUser = { id: 'a' };
    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));
    const staleHandleA = result.current.handleChange;

    mockUser = null;
    rerender();
    expect(result.current.content).toBe('');
    upserts.length = 0;

    act(() => {
      staleHandleA('A INJECTED');
    });
    await flushDebounce();

    expect(result.current.content).toBe('');
    expect(localStorage.getItem(`${PREFIX}_a__pending`)).toBeNull();
    expect(upserts).toEqual([]);
  });

  it('P1-1: after logout and re-login as A, a retained pre-logout handle never writes under another owner', async () => {
    mockUser = { id: 'a' };
    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));
    const preLogoutHandleA = result.current.handleChange;

    mockUser = null;
    rerender();
    mockUser = { id: 'a' };
    rerender();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));
    upserts.length = 0;

    act(() => {
      preLogoutHandleA('A AGAIN');
    });
    await flushDebounce();

    for (const u of upserts) {
      expect(u.owner).toBe('a');
    }
    expect(localStorage.getItem(`${PREFIX}_b__pending`)).toBeNull();
  });

  it('P1-2: an A-scoped save wake can never drain with B configuration', async () => {
    mockUser = { id: 'a' };
    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));

    // A is dirty with an unsaved journal, and owns a connectivity wake.
    online = false;
    const staleHandleA = result.current.handleChange;
    act(() => {
      staleHandleA('A OFFLINE EDIT');
    });
    await flushDebounce();
    const aWakes = [...connectivityListeners];
    expect(aWakes.length).toBeGreaterThan(0);
    expect(localStorage.getItem(`${PREFIX}_a__pending`)).toContain('A OFFLINE EDIT');

    mockUser = { id: 'b' };
    rerender();
    await waitFor(() => expect(result.current.content).toBe('B SERVER'));
    upserts.length = 0;
    online = true;

    // The retained A wake fires after the transition, and the stale A handle
    // tries to re-dirty the shared refs at the same time.
    act(() => {
      staleHandleA('A OFFLINE EDIT 2');
      for (const w of aWakes) w(true);
    });
    await flushDebounce();

    for (const u of upserts) {
      expect(u.owner).toBe('b');
      expect(u.content).not.toContain('A OFFLINE EDIT');
    }
    expect(upserts.filter((u) => u.owner === 'b' && u.content.startsWith('A '))).toEqual([]);
    // A's journal must remain intact and untouched by B's session.
    expect(localStorage.getItem(`${PREFIX}_a__pending`)).toContain('A OFFLINE EDIT');
  });

  it('positive control: a normal same-account edit still debounces and saves', async () => {
    mockUser = { id: 'a' };
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));
    upserts.length = 0;

    act(() => {
      result.current.handleChange('A REAL EDIT');
    });
    await flushDebounce();

    expect(upserts).toContainEqual({ owner: 'a', content: 'A REAL EDIT' });
    await waitFor(() => expect(result.current.lastSaved).not.toBeNull());
    expect(result.current.saveFailed).toBe(false);
    expect(localStorage.getItem(`${PREFIX}_a__pending`)).toBeNull();
  });

  it('positive control: a reconnect wake for the current account still drains', async () => {
    mockUser = { id: 'a' };
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));

    online = false;
    act(() => {
      result.current.handleChange('A RECONNECT EDIT');
    });
    await flushDebounce();
    expect(upserts).toEqual([]);

    online = true;
    await act(async () => {
      for (const w of [...connectivityListeners]) w(true);
      await sleep(50);
    });

    expect(upserts).toContainEqual({ owner: 'a', content: 'A RECONNECT EDIT' });
  });

  it('a real saveFailed=true is masked immediately on the identity transition', async () => {
    mockUser = { id: 'a' };
    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));

    // Journaling the pending edit fails → saveFailed becomes genuinely true.
    const original = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key.endsWith('__pending')) throw new Error('quota');
        return original.call(this, key, value);
      });
    try {
      act(() => {
        result.current.handleChange('A UNJOURNALED');
      });
      await waitFor(() => expect(result.current.saveFailed).toBe(true));

      mockUser = { id: 'b' };
      rerender();

      expect(result.current.saveFailed).toBe(false);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.lastSaved).toBeNull();
    } finally {
      spy.mockRestore();
    }
    await flushDebounce();
  });
});
