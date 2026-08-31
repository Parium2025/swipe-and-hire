/**
 * TDD Regression — no account A leakage on the identity transition render.
 *
 * On A -> B and A -> logout, NO render visible to the new identity may expose
 * A's content, noteData, isSaving, saveFailed or lastSaved.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const PREFIX = 'jobseeker_notes_cache';
/** Mirrors the hook's internal debounce window. */
const SAVE_DEBOUNCE_MS = 1200;

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
    const channel: MockChannel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return channel;
  },
}));

let rpcResolve: (() => void) | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({
      data: mockUser ? {
        id: `row-${mockUser.id}`,
        content: `${mockUser.id.toUpperCase()} SERVER`,
        revision: 0,
        updated_at: '2026-08-30T00:00:00.000Z',
      } : null,
      error: null as null,
    }),
  };
  return {
    supabase: {
      from: () => builder,
      rpc: async (
        fn: string,
        args: { p_content: string; p_expected_revision: number; p_expected_user_id: string }
      ) => {
        if (fn !== 'save_jobseeker_note') throw new Error(`Unexpected RPC: ${fn}`);
        await new Promise<void>((res) => {
          rpcResolve = res;
        });
        return {
          data: [{
            save_status: 'saved',
            server_content: args.p_content,
            server_revision: args.p_expected_revision + 1,
            server_updated_at: '2026-08-30T00:00:00.000Z',
          }],
          error: null as null,
        };
      },
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

type Snapshot = {
  user: string | null;
  content: string;
  noteId: string | null;
  isSaving: boolean;
  saveFailed: boolean;
  lastSaved: Date | null;
};

function renderWithHistory() {
  const history: Snapshot[] = [];
  const utils = renderHook(
    () => {
      const r = useNotesSync({
        table: 'jobseeker_notes',
        ownerColumn: 'user_id',
        cachePrefix: PREFIX,
        queryKey: 'jobseeker-note',
      });
      history.push({
        user: mockUser?.id ?? null,
        content: r.content,
        noteId: r.noteData?.id ?? null,
        isSaving: r.isSaving,
        saveFailed: r.saveFailed,
        lastSaved: r.lastSaved,
      });
      return r;
    },
    { wrapper }
  );
  return { ...utils, history };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Releases any save still parked inside the mocked RPC so no test can hang. */
function releaseInFlightSave() {
  const resolve = rpcResolve;
  rpcResolve = null;
  resolve?.();
}

describe('useNotesSync — identity transition leakage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser = null;
    rpcResolve = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    releaseInFlightSave();
  });

  it('never exposes A content/status to B during an A -> B switch', async () => {
    localStorage.setItem(`${PREFIX}_a`, 'A CONTENT');
    mockUser = { id: 'a' };

    const { result, rerender, history } = renderWithHistory();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));

    // 1) A completed save → real, non-null lastSaved evidence.
    act(() => {
      result.current.handleChange('A SAVED EDIT');
    });
    await act(async () => {
      await sleep(SAVE_DEBOUNCE_MS + 200);
    });
    await waitFor(() => expect(rpcResolve).not.toBeNull());
    await act(async () => {
      releaseInFlightSave();
      await sleep(0);
    });
    await waitFor(() => expect(result.current.lastSaved).not.toBeNull());

    // 2) A second edit parked in an in-flight save → isSaving is genuinely true.
    act(() => {
      result.current.handleChange('A PENDING EDIT');
    });
    await act(async () => {
      await sleep(SAVE_DEBOUNCE_MS + 200);
    });
    await waitFor(() => expect(result.current.isSaving).toBe(true));
    expect(result.current.lastSaved).not.toBeNull();
    expect(result.current.content).toBe('A PENDING EDIT');

    history.length = 0;
    mockUser = { id: 'b' };
    rerender();

    await waitFor(() => expect(result.current.content).toBe('B SERVER'));

    const bSnapshots = history.filter((s) => s.user === 'b');
    expect(bSnapshots.length).toBeGreaterThan(0);
    for (const snap of bSnapshots) {
      expect(snap.content).not.toContain('A ');
      expect(snap.noteId).not.toBe('row-a');
      expect(snap.isSaving).toBe(false);
      expect(snap.saveFailed).toBe(false);
      expect(snap.lastSaved).toBeNull();
    }
  });

  it('never exposes A content/status after logout (A -> null)', async () => {
    localStorage.setItem(`${PREFIX}_a`, 'A CONTENT');
    mockUser = { id: 'a' };

    const { result, rerender, history } = renderWithHistory();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));

    act(() => {
      result.current.handleChange('A PENDING EDIT');
    });
    await act(async () => {
      await sleep(SAVE_DEBOUNCE_MS + 200);
    });
    await waitFor(() => expect(result.current.isSaving).toBe(true));

    history.length = 0;
    mockUser = null;
    rerender();

    const nullSnapshots = history.filter((s) => s.user === null);
    expect(nullSnapshots.length).toBeGreaterThan(0);
    for (const snap of nullSnapshots) {
      expect(snap.content).toBe('');
      expect(snap.noteId).toBeNull();
      expect(snap.isSaving).toBe(false);
      expect(snap.saveFailed).toBe(false);
      expect(snap.lastSaved).toBeNull();
    }
    expect(result.current.content).toBe('');
    expect(result.current.noteData).toBeNull();
  });
});
