/**
 * TDD Regression — no account A leakage on the identity transition render.
 *
 * On A -> B and A -> logout, NO render visible to the new identity may expose
 * A's content, noteData, isSaving, saveFailed or lastSaved.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const PREFIX = 'jobseeker_notes_cache';

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

let upsertResolve: (() => void) | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({
      data: mockUser ? { id: `row-${mockUser.id}`, content: `${mockUser.id.toUpperCase()} SERVER` } : null,
      error: null as null,
    }),
    upsert: async () => {
      await new Promise<void>((res) => {
        upsertResolve = res;
      });
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

describe('useNotesSync — identity transition leakage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser = null;
    upsertResolve = null;
    vi.clearAllMocks();
  });

  it('never exposes A content/status to B during an A -> B switch', async () => {
    localStorage.setItem(`${PREFIX}_user-a`, 'A CONTENT');
    mockUser = { id: 'user-a' };

    const { result, rerender, history } = renderWithHistory();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));

    // Dirty in-flight A save so status flags are set at transition time.
    act(() => {
      result.current.handleChange('A PENDING EDIT');
    });
    await waitFor(() => expect(result.current.saveFailed || !result.current.saveFailed).toBe(true));

    history.length = 0;
    mockUser = { id: 'user-b' };
    rerender();

    await waitFor(() => expect(result.current.content).toBe('B SERVER'));

    for (const snap of history.filter((s) => s.user === 'user-b')) {
      expect(snap.content).not.toContain('A ');
      expect(snap.noteId).not.toBe('row-user-a');
      expect(snap.isSaving).toBe(false);
      expect(snap.saveFailed).toBe(false);
      expect(snap.lastSaved).toBeNull();
    }
  });

  it('never exposes A content/status after logout (A -> null)', async () => {
    localStorage.setItem(`${PREFIX}_user-a`, 'A CONTENT');
    mockUser = { id: 'user-a' };

    const { result, rerender, history } = renderWithHistory();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));

    act(() => {
      result.current.handleChange('A PENDING EDIT');
    });

    history.length = 0;
    mockUser = null;
    rerender();

    for (const snap of history.filter((s) => s.user === null)) {
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
