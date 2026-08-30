/**
 * TDD Regression — a content update originating under account A must never be
 * relabelled as belonging to B (or to the logged-out identity).
 *
 * The storage listener registered while A was current stays alive until the
 * passive cleanup runs. A late A event delivered after B's layout reset must be
 * rejected outright, not committed with the live render-time identity.
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

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({
      data: mockUser ? { id: `row-${mockUser.id}`, content: `${mockUser.id.toUpperCase()} SERVER` } : null,
      error: null as null,
    }),
    upsert: async () => ({ error: null as null }),
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

/** Captures every `storage` listener the hook registers, and keeps them
 *  callable even after React removes them (simulating an event already
 *  dispatched/queued before passive cleanup ran). */
function captureStorageListeners() {
  const listeners: EventListener[] = [];
  const addSpy = vi.spyOn(window, 'addEventListener');
  addSpy.mockImplementation(((type: string, handler: EventListener, opts?: unknown) => {
    if (type === 'storage') listeners.push(handler);
    return (addSpy.getMockImplementation as unknown as never) && undefined;
  }) as unknown as typeof window.addEventListener);
  return {
    listeners,
    restore: () => addSpy.mockRestore(),
  };
}

function makeEvent(key: string, newValue: string) {
  return { key, newValue } as unknown as StorageEvent;
}

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

describe('useNotesSync — late source ownership', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser = null;
    vi.clearAllMocks();
  });

  it('rejects a late A storage callback after switching A -> B', async () => {
    const cap = captureStorageListeners();
    try {
      mockUser = { id: 'a' };
      const { result, rerender } = renderNotes();
      await waitFor(() => expect(result.current.content).toBe('A SERVER'));
      const aListeners = [...cap.listeners];
      expect(aListeners.length).toBeGreaterThan(0);

      mockUser = { id: 'b' };
      rerender();
      await waitFor(() => expect(result.current.content).toBe('B SERVER'));

      // Late event from A's listener, delivered after B's layout reset.
      act(() => {
        for (const l of aListeners) l(makeEvent(`${PREFIX}_a`, 'A LEAKED CONTENT'));
      });

      expect(result.current.content).not.toBe('A LEAKED CONTENT');
      expect(result.current.content).toBe('B SERVER');
    } finally {
      cap.restore();
    }
  });

  it('rejects a late A storage callback after logout (A -> null)', async () => {
    const cap = captureStorageListeners();
    try {
      mockUser = { id: 'a' };
      const { result, rerender } = renderNotes();
      await waitFor(() => expect(result.current.content).toBe('A SERVER'));
      const aListeners = [...cap.listeners];

      mockUser = null;
      rerender();
      expect(result.current.content).toBe('');

      act(() => {
        for (const l of aListeners) l(makeEvent(`${PREFIX}_a`, 'A LEAKED CONTENT'));
      });

      expect(result.current.content).toBe('');
      expect(result.current.noteData).toBeNull();
    } finally {
      cap.restore();
    }
  });

  it('still applies a legitimate same-account storage update', async () => {
    const cap = captureStorageListeners();
    try {
      mockUser = { id: 'a' };
      const { result } = renderNotes();
      await waitFor(() => expect(result.current.content).toBe('A SERVER'));
      const aListeners = [...cap.listeners];

      act(() => {
        for (const l of aListeners) l(makeEvent(`${PREFIX}_a`, 'A CROSS TAB'));
      });

      expect(result.current.content).toBe('A CROSS TAB');
    } finally {
      cap.restore();
    }
  });
});
