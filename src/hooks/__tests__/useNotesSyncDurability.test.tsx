/**
 * TDD — Notes persistence durability & account isolation (useNotesSync).
 *
 * Contract:
 *  - raw `${prefix}_${uid}` = clean server snapshot only
 *  - `${prefix}_${uid}__pending` = versioned journal, sole authority for dirty edits
 *  - all storage access exception-safe; query errors != successful empty note
 *  - single-flight save drain, epoch-scoped async completions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const PREFIX = 'jobseeker_notes_cache';
const cleanKey = (uid: string) => `${PREFIX}_${uid}`;
const pendingKey = (uid: string) => `${PREFIX}_${uid}__pending`;

let mockUser: { id: string } | null = null;
let online = true;
let connectivityCb: ((online: boolean) => void) | null = null;

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));

vi.mock('@/lib/connectivityManager', () => ({
  getIsOnline: () => online,
  onConnectivityChange: (cb: (o: boolean) => void) => {
    connectivityCb = cb;
    return () => { connectivityCb = null; };
  },
}));

let channelCount = 0;
vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: () => {
    channelCount++;
    const ch: any = { on: (..._a: unknown[]) => ch, subscribe: () => ch };
    return ch;
  },
}));

interface QueryResult { data: unknown; error: unknown }
let queryResult: QueryResult = { data: null, error: null };
let upsertImpl: (row: unknown) => Promise<{ error: unknown }> = async () => ({ error: null });
let upsertCalls: unknown[] = [];

vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => queryResult,
    upsert: (row: unknown) => { upsertCalls.push(row); return upsertImpl(row); },
  };
  return {
    supabase: {
      from: () => builder,
      removeChannel: () => { channelCount--; },
      auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  };
});

import { useNotesSync } from '@/hooks/useNotesSync';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const renderNotes = () =>
  renderHook(
    () => useNotesSync({ table: 'jobseeker_notes', ownerColumn: 'user_id', cachePrefix: PREFIX, queryKey: 'jobseeker-note' }),
    { wrapper }
  );

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

const writePending = (uid: string, content: string) =>
  localStorage.setItem(pendingKey(uid), JSON.stringify({ v: 1, u: uid, c: content, t: Date.now() }));

describe('useNotesSync — durability & isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser = null;
    online = true;
    connectivityCb = null;
    channelCount = 0;
    upsertCalls = [];
    upsertImpl = async () => ({ error: null });
    queryResult = { data: null, error: null };
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('survives throwing storage and ignores corrupt/wrong-version pending', async () => {
    mockUser = { id: 'u1' };
    localStorage.setItem(pendingKey('u1'), '{{{not json');
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const remSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });

    const { result } = renderNotes();
    expect(result.current.content).toBe('');
    act(() => { result.current.handleChange('typed'); });
    expect(result.current.content).toBe('typed');
    expect(result.current.saveFailed).toBe(true);

    getSpy.mockRestore(); setSpy.mockRestore(); remSpy.mockRestore();

    // wrong version envelope is ignored
    localStorage.setItem(pendingKey('u1'), JSON.stringify({ v: 99, u: 'u1', c: 'OLD' }));
    const second = renderNotes();
    expect(second.result.current.content).toBe('');
  });

  it('pending wins over clean cache and stale query/realtime cannot overwrite it', async () => {
    mockUser = { id: 'u1' };
    localStorage.setItem(cleanKey('u1'), 'A');
    writePending('u1', 'B');
    queryResult = { data: { id: '1', content: 'A' }, error: null };

    const { result } = renderNotes();
    expect(result.current.content).toBe('B');
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(result.current.content).toBe('B');
  });

  it('query error is not a successful empty note', async () => {
    mockUser = { id: 'u1' };
    localStorage.setItem(cleanKey('u1'), 'SERVER');
    queryResult = { data: null, error: new Error('boom') };

    const { result } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('SERVER'));
    expect(localStorage.getItem(cleanKey('u1'))).toBe('SERVER');
  });

  it('offline edit writes only pending, clean snapshot untouched', async () => {
    mockUser = { id: 'u1' };
    localStorage.setItem(cleanKey('u1'), 'SERVER');
    online = false;
    const { result } = renderNotes();
    act(() => { result.current.handleChange('offline edit'); });
    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(localStorage.getItem(cleanKey('u1'))).toBe('SERVER');
    expect(JSON.parse(localStorage.getItem(pendingKey('u1'))!).c).toBe('offline edit');
    expect(upsertCalls.length).toBe(0);
  });

  it('successful save writes clean then removes pending; failure retains pending', async () => {
    mockUser = { id: 'u1' };
    queryResult = { data: { id: '1', content: '' }, error: null };
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    act(() => { result.current.handleChange('saved text'); });
    expect(localStorage.getItem(pendingKey('u1'))).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(localStorage.getItem(cleanKey('u1'))).toBe('saved text'));
    expect(localStorage.getItem(pendingKey('u1'))).toBeNull();

    upsertImpl = async () => ({ error: { message: 'nope' } });
    act(() => { result.current.handleChange('fails'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(result.current.saveFailed).toBe(true));
    expect(JSON.parse(localStorage.getItem(pendingKey('u1'))!).c).toBe('fails');
    expect(localStorage.getItem(cleanKey('u1'))).toBe('saved text');
  });

  it('empty-string edit is journaled and saved', async () => {
    mockUser = { id: 'u1' };
    queryResult = { data: { id: '1', content: 'x' }, error: null };
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    act(() => { result.current.handleChange(''); });
    expect(JSON.parse(localStorage.getItem(pendingKey('u1'))!).c).toBe('');
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(upsertCalls.length).toBe(1));
    expect((upsertCalls[0] as any).content).toBe('');
  });

  it('edits during an in-flight save coalesce to latest and save exactly once after', async () => {
    mockUser = { id: 'u1' };
    queryResult = { data: { id: '1', content: '' }, error: null };
    const d = deferred<{ error: unknown }>();
    let call = 0;
    upsertImpl = (() => { call++; return call === 1 ? d.promise : Promise.resolve({ error: null }); }) as any;

    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    act(() => { result.current.handleChange('A'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(upsertCalls.length).toBe(1));

    act(() => { result.current.handleChange('B1'); });
    act(() => { result.current.handleChange('B'); });
    // reconnect signal while A in flight must not start a second concurrent save
    act(() => { connectivityCb?.(true); });
    expect(upsertCalls.length).toBe(1);

    await act(async () => { d.resolve({ error: null }); await Promise.resolve(); vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(upsertCalls.length).toBe(2));
    expect((upsertCalls[1] as any).content).toBe('B');
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(upsertCalls.length).toBe(2);
  });

  it('a save resolving after account switch cannot touch the next account', async () => {
    mockUser = { id: 'a' };
    queryResult = { data: { id: '1', content: '' }, error: null };
    const d = deferred<{ error: unknown }>();
    upsertImpl = (() => d.promise) as any;

    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange('A CONTENT'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(upsertCalls.length).toBe(1));

    mockUser = { id: 'b' };
    rerender();
    await waitFor(() => expect(result.current.content).toBe(''));

    await act(async () => { d.resolve({ error: null }); await Promise.resolve(); });

    expect(result.current.content).toBe('');
    expect(localStorage.getItem(cleanKey('b'))).not.toBe('A CONTENT');
    expect(localStorage.getItem(pendingKey('b'))).toBeNull();
    expect(result.current.saveFailed).toBe(false);
  });

  it('unmount cleans up channel, listener and timers (no duplicate saves)', async () => {
    mockUser = { id: 'u1' };
    queryResult = { data: { id: '1', content: '' }, error: null };
    const { result, unmount } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange('draft'); });

    unmount();
    expect(channelCount).toBe(0);
    expect(connectivityCb).toBeNull();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(upsertCalls.length).toBe(0);
  });
});
