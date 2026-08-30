/**
 * TDD — Notes persistence race hardening (useNotesSync).
 *
 * Covers the diff-review findings:
 *  1. cross-account in-flight isolation (per-epoch drain token)
 *  2. hydrated pending replay (mount + account transition)
 *  3. exact storage acknowledgement + local revision safety
 *  4. stale query rollback
 *  5. late realtime isolation
 *  6. access-token / beforeunload hardening
 *  + storage failure still saves online, authoritative empty query,
 *    reconnect drain, StrictMode single-save.
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

type RtHandler = (payload: unknown) => void;
interface RtChannel { name: string; handler: RtHandler | null }
let channels: RtChannel[] = [];
vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: (name: string) => {
    const entry: RtChannel = { name, handler: null };
    channels.push(entry);
    const ch: any = {
      on: (_e: string, _f: unknown, cb: RtHandler) => { entry.handler = cb; return ch; },
      subscribe: () => ch,
      __entry: entry,
    };
    return ch;
  },
}));

interface QueryResult { data: unknown; error: unknown }
let queryImpl: () => Promise<QueryResult> = async () => ({ data: null, error: null });
let upsertImpl: (row: unknown) => Promise<{ error: unknown }> = async () => ({ error: null });
let upsertCalls: any[] = [];
let sessionImpl: () => Promise<{ data: { session: { access_token: string } | null } }> =
  async () => ({ data: { session: { access_token: 'token-default' } } });
let authCb: ((e: string, s: unknown) => void) | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => queryImpl(),
    upsert: (row: unknown) => { upsertCalls.push(row); return upsertImpl(row); },
  };
  return {
    supabase: {
      from: () => builder,
      removeChannel: (ch: any) => { channels = channels.filter((c) => c !== ch.__entry); },
      auth: {
        getSession: () => sessionImpl(),
        onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
          authCb = cb;
          return { data: { subscription: { unsubscribe: () => { authCb = null; } } } };
        },
      },
    },
  };
});

import { useNotesSync } from '@/hooks/useNotesSync';

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const ref = React.useRef<QueryClient>();
  if (!ref.current) ref.current = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={ref.current}>{children}</QueryClientProvider>;
};

const renderNotes = (opts?: { strict?: boolean }) =>
  renderHook(
    () => useNotesSync({ table: 'jobseeker_notes', ownerColumn: 'user_id', cachePrefix: PREFIX, queryKey: 'jobseeker-note' }),
    {
      wrapper: opts?.strict
        ? ({ children }) => <React.StrictMode><Wrapper>{children}</Wrapper></React.StrictMode>
        : Wrapper,
    }
  );

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

const writePendingRaw = (uid: string, content: string) =>
  localStorage.setItem(pendingKey(uid), JSON.stringify({ v: 1, u: uid, c: content, t: Date.now() }));

describe('useNotesSync — race hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser = null;
    online = true;
    connectivityCb = null;
    authCb = null;
    channels = [];
    upsertCalls = [];
    upsertImpl = async () => ({ error: null });
    queryImpl = async () => ({ data: null, error: null });
    sessionImpl = async () => ({ data: { session: { access_token: 'token-default' } } });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  // ── 1. cross-account in-flight isolation ────────────────────────────
  it('account B can save while A is still in flight, and A cannot touch B', async () => {
    mockUser = { id: 'a' };
    queryImpl = async () => ({ data: { id: '1', content: '' }, error: null });
    const dA = deferred<{ error: unknown }>();
    const dB = deferred<{ error: unknown }>();
    let n = 0;
    upsertImpl = (() => { n++; return n === 1 ? dA.promise : dB.promise; }) as any;

    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange('A CONTENT'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(upsertCalls.length).toBe(1));

    mockUser = { id: 'b' };
    rerender();
    await waitFor(() => expect(result.current.content).toBe(''));

    act(() => { result.current.handleChange('B CONTENT'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    // B must not be blocked by A's in-flight save
    await waitFor(() => expect(upsertCalls.length).toBe(2));
    expect(upsertCalls[1].content).toBe('B CONTENT');

    await act(async () => { dA.resolve({ error: null }); await Promise.resolve(); });
    expect(result.current.content).toBe('B CONTENT');
    expect(localStorage.getItem(cleanKey('b'))).not.toBe('A CONTENT');
    expect(localStorage.getItem(pendingKey('b'))).not.toBeNull();

    await act(async () => { dB.resolve({ error: null }); await Promise.resolve(); });
    await waitFor(() => expect(localStorage.getItem(cleanKey('b'))).toBe('B CONTENT'));
  });

  // ── 2. hydrated pending replay ──────────────────────────────────────
  it('replays hydrated pending on initial mount without a new edit', async () => {
    mockUser = { id: 'u1' };
    writePendingRaw('u1', 'RECOVERED');
    const { result } = renderNotes();
    expect(result.current.content).toBe('RECOVERED');
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(upsertCalls.length).toBe(1));
    expect(upsertCalls[0].content).toBe('RECOVERED');
  });

  it('replays hydrated pending after an A→B account transition', async () => {
    mockUser = { id: 'a' };
    const { rerender } = renderNotes();
    writePendingRaw('b', 'B RECOVERED');
    mockUser = { id: 'b' };
    rerender();
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(upsertCalls.some((c) => c.content === 'B RECOVERED')).toBe(true));
  });

  // ── 3. acknowledgement order / revision safety ──────────────────────
  it('writes clean cache before removing pending', async () => {
    mockUser = { id: 'u1' };
    const order: string[] = [];
    const realSet = localStorage.setItem.bind(localStorage);
    const realRem = localStorage.removeItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string, v: string) => {
      if (k === cleanKey('u1')) order.push('clean');
      realSet(k, v);
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((k: string) => {
      if (k === pendingKey('u1')) order.push('pending-removed');
      realRem(k);
    });

    const { result } = renderNotes();
    act(() => { result.current.handleChange('X'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(order).toEqual(['clean', 'pending-removed']));
  });

  it('retains pending and flags saveFailed when the clean write fails', async () => {
    mockUser = { id: 'u1' };
    const realSet = localStorage.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string, v: string) => {
      if (k === cleanKey('u1')) throw new Error('denied');
      realSet(k, v);
    });

    const { result } = renderNotes();
    act(() => { result.current.handleChange('X'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(result.current.saveFailed).toBe(true));
    expect(JSON.parse(localStorage.getItem(pendingKey('u1'))!).c).toBe('X');
    const calls = upsertCalls.length;
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(upsertCalls.length).toBe(calls); // no tight retry loop
  });

  it('a same-content newer edit during flight is not acknowledged accidentally', async () => {
    mockUser = { id: 'u1' };
    const d = deferred<{ error: unknown }>();
    let n = 0;
    upsertImpl = (() => { n++; return n === 1 ? d.promise : Promise.resolve({ error: null }); }) as any;

    const { result } = renderNotes();
    act(() => { result.current.handleChange('SAME'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(upsertCalls.length).toBe(1));

    act(() => { result.current.handleChange('SAME'); }); // newer revision, same text
    await act(async () => { d.resolve({ error: null }); await Promise.resolve(); vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(upsertCalls.length).toBe(2));
    await waitFor(() => expect(localStorage.getItem(pendingKey('u1'))).toBeNull());
  });

  // ── 4. stale query rollback ─────────────────────────────────────────
  it('a query started before an acknowledged save cannot overwrite it', async () => {
    mockUser = { id: 'u1' };
    const q = deferred<QueryResult>();
    queryImpl = () => q.promise;

    const { result } = renderNotes();
    act(() => { result.current.handleChange('B'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(localStorage.getItem(cleanKey('u1'))).toBe('B'));

    await act(async () => { q.resolve({ data: { id: '1', content: 'A' }, error: null }); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(50); });

    expect(result.current.content).toBe('B');
    expect(localStorage.getItem(cleanKey('u1'))).toBe('B');
  });

  // ── 5. late realtime isolation ──────────────────────────────────────
  it('a realtime callback from account A cannot touch account B', async () => {
    mockUser = { id: 'a' };
    const { result, rerender } = renderNotes();
    await waitFor(() => expect(channels.length).toBeGreaterThan(0));
    const oldHandler = channels[0].handler!;

    mockUser = { id: 'b' };
    rerender();
    await waitFor(() => expect(result.current.content).toBe(''));

    await act(async () => { oldHandler({ new: { content: 'A LEAK' } }); });
    expect(result.current.content).toBe('');
    expect(localStorage.getItem(cleanKey('b'))).not.toBe('A LEAK');
    expect(result.current.saveFailed).toBe(false);
  });

  // ── 6. access token / beforeunload ──────────────────────────────────
  it('beforeunload posts with the on_conflict target and survives fetch rejection', async () => {
    mockUser = { id: 'u1' };
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network')));
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderNotes();
    await act(async () => { await Promise.resolve(); });
    act(() => { result.current.handleChange('UNLOADED'); });
    act(() => { window.dispatchEvent(new Event('beforeunload')); });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('on_conflict=user_id');
    expect(JSON.parse(localStorage.getItem(pendingKey('u1'))!).c).toBe('UNLOADED');
    await act(async () => { await Promise.resolve(); });
  });

  it('beforeunload does not compete with an active normal save', async () => {
    mockUser = { id: 'u1' };
    const d = deferred<{ error: unknown }>();
    upsertImpl = (() => d.promise) as any;
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null)));
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderNotes();
    await act(async () => { await Promise.resolve(); });
    act(() => { result.current.handleChange('INFLIGHT'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(upsertCalls.length).toBe(1));

    act(() => { window.dispatchEvent(new Event('beforeunload')); });
    expect(fetchSpy).not.toHaveBeenCalled();
    await act(async () => { d.resolve({ error: null }); await Promise.resolve(); });
  });

  it('never uses the previous account access token after an account change', async () => {
    mockUser = { id: 'a' };
    const s = deferred<{ data: { session: { access_token: string } | null } }>();
    sessionImpl = () => s.promise;
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null)));
    vi.stubGlobal('fetch', fetchSpy);

    const { result, rerender } = renderNotes();
    mockUser = { id: 'b' };
    rerender();
    await act(async () => { s.resolve({ data: { session: { access_token: 'A-TOKEN' } } }); await Promise.resolve(); });

    act(() => { result.current.handleChange('B EDIT'); });
    act(() => { window.dispatchEvent(new Event('beforeunload')); });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ── extra acceptance ────────────────────────────────────────────────
  it('storage failure still allows the online database save', async () => {
    mockUser = { id: 'u1' };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const { result } = renderNotes();
    act(() => { result.current.handleChange('NO STORAGE'); });
    expect(result.current.saveFailed).toBe(true);
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(upsertCalls.length).toBe(1));
    expect(upsertCalls[0].content).toBe('NO STORAGE');
  });

  it('a successful null query is an authoritative empty result', async () => {
    mockUser = { id: 'u1' };
    localStorage.setItem(cleanKey('u1'), 'OLD');
    queryImpl = async () => ({ data: null, error: null });
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe(''));
    expect(localStorage.getItem(cleanKey('u1'))).toBe('');
  });

  it('reconnect drains hydrated pending', async () => {
    mockUser = { id: 'u1' };
    online = false;
    writePendingRaw('u1', 'OFFLINE PENDING');
    const { result } = renderNotes();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(upsertCalls.length).toBe(0);

    online = true;
    await act(async () => { connectivityCb?.(true); await Promise.resolve(); vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(upsertCalls.length).toBe(1));
    expect(result.current.content).toBe('OFFLINE PENDING');
  });

  it('StrictMode does not duplicate saves or listeners', async () => {
    mockUser = { id: 'u1' };
    const { result } = renderNotes({ strict: true });
    act(() => { result.current.handleChange('STRICT'); });
    await act(async () => { vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(upsertCalls.length).toBe(1));
    expect(channels.length).toBe(1);
  });
});
