/**
 * TDD RED — jobseeker notes DATA cache isolation.
 *
 * Behavior contract (data layer only, no UI involvement):
 *  - No legacy unscoped `jobseeker_notes_cache` reads or writes, ever.
 *  - Writes only happen for an authenticated user, under `jobseeker_notes_cache_<uid>`.
 *  - Account switch A -> B must reset content/edit refs; A's pending edit must
 *    never be persisted under B.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const LEGACY_KEY = 'jobseeker_notes_cache';

let mockUser: { id: string } | null = null;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('@/lib/connectivityManager', () => ({
  getIsOnline: () => true,
  onConnectivityChange: () => () => {},
}));

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: () => {
    const channel: any = {
      on: () => channel,
      subscribe: () => channel,
    };
    return channel;
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
    upsert: async () => ({ error: null }),
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

const renderNotes = () =>
  renderHook(
    () =>
      useNotesSync({
        table: 'jobseeker_notes',
        ownerColumn: 'user_id',
        cachePrefix: LEGACY_KEY,
        queryKey: 'jobseeker-note',
      }),
    { wrapper }
  );

describe('useNotesSync — notes data cache isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser = null;
    vi.clearAllMocks();
  });

  it('renders empty and never reads the legacy unscoped key before auth hydration', () => {
    localStorage.setItem(LEGACY_KEY, 'LEGACY LEAK');
    const getSpy = vi.spyOn(Storage.prototype, 'getItem');

    const { result } = renderNotes();

    expect(result.current.content).toBe('');
    expect(getSpy.mock.calls.map((c) => c[0])).not.toContain(LEGACY_KEY);
    getSpy.mockRestore();
  });

  it('does not write any notes cache key when user is null', () => {
    const { result } = renderNotes();

    act(() => {
      result.current.handleChange('anonymous typing');
    });

    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    const notesKeys = Object.keys(localStorage).filter((k) => k.startsWith(LEGACY_KEY));
    expect(notesKeys).toEqual([]);
  });

  it('hydrates only user B scoped cache — never legacy or user A data', async () => {
    localStorage.setItem(LEGACY_KEY, 'LEGACY LEAK');
    localStorage.setItem(`${LEGACY_KEY}_user-a`, 'A CONTENT');
    localStorage.setItem(`${LEGACY_KEY}_user-b`, 'B CONTENT');

    const { result, rerender } = renderNotes();
    expect(result.current.content).toBe('');

    mockUser = { id: 'user-b' };
    rerender();

    await waitFor(() => expect(result.current.content).toBe('B CONTENT'));
  });

  it('resets content and pending edits when switching account A -> B', async () => {
    localStorage.setItem(`${LEGACY_KEY}_user-a`, 'A CONTENT');
    mockUser = { id: 'user-a' };

    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('A CONTENT'));

    act(() => {
      result.current.handleChange('A PENDING EDIT');
    });
    expect(localStorage.getItem(`${LEGACY_KEY}_user-a`)).toBe('A PENDING EDIT');

    mockUser = { id: 'user-b' };
    rerender();

    // B has no cache of its own → must be empty, never A's content
    await waitFor(() => expect(result.current.content).toBe(''));
    expect(localStorage.getItem(`${LEGACY_KEY}_user-b`)).toBeNull();
  });

  it('positive control: authenticated user hydrates and persists own scoped cache', async () => {
    localStorage.setItem(`${LEGACY_KEY}_user-a`, 'A CONTENT');
    mockUser = { id: 'user-a' };

    const { result } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('A CONTENT'));

    act(() => {
      result.current.handleChange('A EDIT');
    });

    expect(result.current.content).toBe('A EDIT');
    expect(localStorage.getItem(`${LEGACY_KEY}_user-a`)).toBe('A EDIT');
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });
});
