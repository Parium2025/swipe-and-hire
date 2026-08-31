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
const revisionKey = (uid: string) => `${PREFIX}_${uid}__revision`;

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
interface MockRtChannel {
  on: (event: string, filter: unknown, callback: RtHandler) => MockRtChannel;
  subscribe: () => MockRtChannel;
  __entry: RtChannel;
}
let channels: RtChannel[] = [];
vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: (name: string) => {
    const entry: RtChannel = { name, handler: null };
    channels.push(entry);
    const ch = {
      on: (_e: string, _f: unknown, cb: RtHandler) => { entry.handler = cb; return ch; },
      subscribe: () => ch,
      __entry: entry,
    } satisfies MockRtChannel;
    return ch;
  },
}));

interface QueryResult { data: unknown; error: unknown }
let queryImpl: () => Promise<QueryResult> = async () => ({ data: null, error: null });
interface RpcArgs { p_content: string; p_expected_revision: number; p_expected_user_id: string }
interface RpcResult { data: unknown; error: unknown }
const savedRpcResult = (args: RpcArgs): RpcResult => ({
  data: [{
    save_status: 'saved',
    server_content: args.p_content,
    server_revision: args.p_expected_revision + 1,
    server_updated_at: '2026-08-30T00:00:00.000Z',
  }],
  error: null,
});
let rpcImpl: (args: RpcArgs) => Promise<RpcResult> = async (args) => savedRpcResult(args);
let rpcCalls: RpcArgs[] = [];
let sessionImpl: () => Promise<{ data: { session: { access_token: string } | null } }> =
  async () => ({ data: { session: { access_token: 'token-default' } } });
let authCb: ((e: string, s: unknown) => void) | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => queryImpl(),
  };
  return {
    supabase: {
      from: () => builder,
      rpc: (fn: string, args: RpcArgs) => {
        if (fn !== 'save_jobseeker_note') throw new Error(`Unexpected RPC: ${fn}`);
        rpcCalls.push(args);
        return rpcImpl(args);
      },
      removeChannel: (ch: MockRtChannel) => { channels = channels.filter((c) => c !== ch.__entry); },
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
    rpcCalls = [];
    rpcImpl = async (args) => savedRpcResult(args);
    queryImpl = async () => ({ data: null, error: null });
    sessionImpl = async () => ({ data: { session: { access_token: 'token-default' } } });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── 1. cross-account in-flight isolation ────────────────────────────
  it('account B can save while A is still in flight, and A cannot touch B', async () => {
    mockUser = { id: 'a' };
    queryImpl = async () => ({
      data: { id: '1', content: '', revision: 0, updated_at: '2026-08-30T00:00:00.000Z' },
      error: null,
    });
    const dA = deferred<RpcResult>();
    const dB = deferred<RpcResult>();
    let n = 0;
    rpcImpl = () => { n++; return n === 1 ? dA.promise : dB.promise; };

    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange('A CONTENT'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(rpcCalls.length).toBe(1));

    mockUser = { id: 'b' };
    rerender();
    await waitFor(() => expect(result.current.content).toBe(''));

    act(() => { result.current.handleChange('B CONTENT'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    // B must not be blocked by A's in-flight save
    await waitFor(() => expect(rpcCalls.length).toBe(2));
    expect(rpcCalls[1]).toEqual({ p_content: 'B CONTENT', p_expected_revision: 0, p_expected_user_id: 'b' });

    await act(async () => { dA.resolve(savedRpcResult(rpcCalls[0])); await Promise.resolve(); });
    expect(result.current.content).toBe('B CONTENT');
    expect(localStorage.getItem(cleanKey('b'))).not.toBe('A CONTENT');
    expect(localStorage.getItem(pendingKey('b'))).not.toBeNull();

    await act(async () => { dB.resolve(savedRpcResult(rpcCalls[1])); await Promise.resolve(); });
    await waitFor(() => expect(localStorage.getItem(cleanKey('b'))).toBe('B CONTENT'));
  });

  // ── 2. hydrated pending replay ──────────────────────────────────────
  it('replays hydrated pending on initial mount without a new edit', async () => {
    mockUser = { id: 'u1' };
    writePendingRaw('u1', 'RECOVERED');
    const { result } = renderNotes();
    expect(result.current.content).toBe('RECOVERED');
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(rpcCalls.length).toBe(1));
    expect(rpcCalls[0]).toEqual({ p_content: 'RECOVERED', p_expected_revision: 0, p_expected_user_id: 'u1' });
  });

  it('replays hydrated pending after an A→B account transition', async () => {
    mockUser = { id: 'a' };
    const { result, rerender } = renderNotes();
    writePendingRaw('b', 'B RECOVERED');
    mockUser = { id: 'b' };
    rerender();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(rpcCalls.some((c) => c.p_content === 'B RECOVERED')).toBe(true));
  });

  // ── 3. acknowledgement order / revision safety ──────────────────────
  it('writes clean cache before removing pending', async () => {
    mockUser = { id: 'u1' };
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

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
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange('X'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(result.current.saveFailed).toBe(true));
    expect(JSON.parse(localStorage.getItem(pendingKey('u1'))!).c).toBe('X');
    const calls = rpcCalls.length;
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(rpcCalls.length).toBe(calls); // no tight retry loop
  });

  it('retries a transient RPC failure with bounded backoff', async () => {
    mockUser = { id: 'u1' };
    let attempt = 0;
    rpcImpl = async (args) => {
      attempt += 1;
      return attempt === 1
        ? { data: null, error: { message: 'temporary' } }
        : savedRpcResult(args);
    };

    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange('RETRY ME'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(rpcCalls.length).toBe(1));
    expect(result.current.saveFailed).toBe(true);

    await act(async () => { vi.advanceTimersByTime(2100); await Promise.resolve(); });
    await waitFor(() => expect(rpcCalls.length).toBe(2));
    await waitFor(() => expect(localStorage.getItem(pendingKey('u1'))).toBeNull());
    expect(result.current.saveFailed).toBe(false);
  });

  it('a same-content newer edit during flight is not acknowledged accidentally', async () => {
    mockUser = { id: 'u1' };
    const d = deferred<RpcResult>();
    let n = 0;
    rpcImpl = (args) => { n++; return n === 1 ? d.promise : Promise.resolve(savedRpcResult(args)); };

    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange('SAME'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(rpcCalls.length).toBe(1));

    act(() => { result.current.handleChange('SAME'); }); // newer revision, same text
    await act(async () => {
      d.resolve(savedRpcResult(rpcCalls[0]));
      await Promise.resolve();
      vi.advanceTimersByTime(2000);
    });
    await waitFor(() => expect(rpcCalls.length).toBe(2));
    await waitFor(() => expect(localStorage.getItem(pendingKey('u1'))).toBeNull());
  });

  // ── 4. stale query rollback ─────────────────────────────────────────
  it('a query started before an acknowledged save cannot overwrite it', async () => {
    mockUser = { id: 'u1' };
    localStorage.setItem(revisionKey('u1'), '0');
    const q = deferred<QueryResult>();
    queryImpl = () => q.promise;

    const { result } = renderNotes();
    act(() => { result.current.handleChange('B'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(localStorage.getItem(cleanKey('u1'))).toBe('B'));

    await act(async () => {
      q.resolve({
        data: { id: '1', content: 'A', revision: 0, updated_at: '2026-08-30T00:00:00.000Z' },
        error: null,
      });
      await Promise.resolve();
    });
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

    await act(async () => {
      oldHandler({ new: { content: 'A LEAK', revision: 1, updated_at: '2026-08-30T00:00:01.000Z' } });
    });
    expect(result.current.content).toBe('');
    expect(localStorage.getItem(cleanKey('b'))).not.toBe('A LEAK');
    expect(result.current.saveFailed).toBe(false);
  });

  // ── 6. access token / beforeunload ──────────────────────────────────
  it('beforeunload posts to the revision RPC and survives fetch rejection', async () => {
    mockUser = { id: 'u1' };
    const fetchSpy = vi.fn((..._args: unknown[]) => Promise.reject(new Error('network')));
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderNotes();
    await waitFor(() => expect(authCb).not.toBeNull());
    act(() => {
      authCb?.('TOKEN_REFRESHED', { access_token: 'token-default' });
    });
    act(() => { result.current.handleChange('UNLOADED'); });
    act(() => { window.dispatchEvent(new Event('beforeunload')); });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/save_jobseeker_note`
    );
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      p_content: 'UNLOADED',
      p_expected_revision: 0,
      p_expected_user_id: 'u1',
    });
    expect(JSON.parse(localStorage.getItem(pendingKey('u1'))!).c).toBe('UNLOADED');
    await act(async () => { await Promise.resolve(); });
  });

  it('beforeunload does not compete with an active normal save', async () => {
    mockUser = { id: 'u1' };
    const d = deferred<RpcResult>();
    rpcImpl = () => d.promise;
    const fetchSpy = vi.fn((..._args: unknown[]) => Promise.resolve(new Response(null)));
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderNotes();
    await act(async () => { await Promise.resolve(); });
    act(() => { result.current.handleChange('INFLIGHT'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(rpcCalls.length).toBe(1));

    act(() => { window.dispatchEvent(new Event('beforeunload')); });
    expect(fetchSpy).not.toHaveBeenCalled();
    await act(async () => { d.resolve(savedRpcResult(rpcCalls[0])); await Promise.resolve(); });
  });

  it('finishes a newer edit after an active save before explicit sign-out can clear its journal', async () => {
    mockUser = { id: 'u1' };
    const first = deferred<RpcResult>();
    const second = deferred<RpcResult>();
    let saveCall = 0;
    rpcImpl = () => {
      saveCall += 1;
      return saveCall === 1 ? first.promise : second.promise;
    };

    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange('OLDER IN FLIGHT'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(rpcCalls.length).toBe(1));

    act(() => { result.current.handleChange('NEWEST BEFORE SIGN OUT'); });
    const flushes: Promise<unknown>[] = [];
    act(() => {
      window.dispatchEvent(new CustomEvent('parium:flush-pending-notes-before-sign-out', {
        detail: {
          waitUntil: (flush: Promise<unknown>) => flushes.push(flush),
        },
      }));
    });

    expect(flushes).toHaveLength(1);
    await act(async () => {
      first.resolve(savedRpcResult(rpcCalls[0]));
      await Promise.resolve();
    });
    await waitFor(() => expect(rpcCalls.length).toBe(2));
    expect(rpcCalls[1]).toEqual({
      p_content: 'NEWEST BEFORE SIGN OUT',
      p_expected_revision: 1,
      p_expected_user_id: 'u1',
    });

    await act(async () => {
      second.resolve(savedRpcResult(rpcCalls[1]));
      await flushes[0];
    });
    expect(localStorage.getItem(pendingKey('u1'))).toBeNull();
    expect(localStorage.getItem(cleanKey('u1'))).toBe('NEWEST BEFORE SIGN OUT');
  });

  it('flushes a keepalive-sized overflow note through normal RPC before explicit sign-out', async () => {
    mockUser = { id: 'u1' };
    const largeContent = `<p>${'x'.repeat(70_000)}</p>`;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange(largeContent); });

    const flushes: Promise<unknown>[] = [];
    act(() => {
      window.dispatchEvent(new CustomEvent('parium:flush-pending-notes-before-sign-out', {
        detail: { waitUntil: (flush: Promise<unknown>) => flushes.push(flush) },
      }));
    });
    expect(flushes).toHaveLength(1);
    await act(async () => { await flushes[0]; });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]).toEqual({
      p_content: largeContent,
      p_expected_revision: 0,
      p_expected_user_id: 'u1',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects explicit sign-out draining while an offline pending journal remains unsaved', async () => {
    mockUser = { id: 'u1' };
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    online = false;
    act(() => { result.current.handleChange('MUST SURVIVE OFFLINE LOGOUT'); });

    const flushes: Promise<unknown>[] = [];
    act(() => {
      window.dispatchEvent(new CustomEvent('parium:flush-pending-notes-before-sign-out', {
        detail: { waitUntil: (flush: Promise<unknown>) => flushes.push(flush) },
      }));
    });

    expect(flushes).toHaveLength(1);
    await expect(flushes[0]).rejects.toThrow('pending note was not saved');
    expect(localStorage.getItem(pendingKey('u1'))).toContain('MUST SURVIVE OFFLINE LOGOUT');
    expect(rpcCalls).toHaveLength(0);
  });

  it('never uses the previous account access token after an account change', async () => {
    mockUser = { id: 'a' };
    const s = deferred<{ data: { session: { access_token: string } | null } }>();
    let sessionCall = 0;
    sessionImpl = () => {
      sessionCall++;
      // only the first (account A) call is deferred; B has no session yet
      return sessionCall === 1 ? s.promise : Promise.resolve({ data: { session: null } });
    };
    const fetchSpy = vi.fn((..._args: unknown[]) => Promise.resolve(new Response(null)));
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
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange('NO STORAGE'); });
    expect(result.current.saveFailed).toBe(true);
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(rpcCalls.length).toBe(1));
    expect(rpcCalls[0]).toEqual({ p_content: 'NO STORAGE', p_expected_revision: 0, p_expected_user_id: 'u1' });
  });

  it('does not trap explicit sign-out after the server saved an edit when storage is unavailable', async () => {
    mockUser = { id: 'u1' };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    act(() => { result.current.handleChange('SERVER-DURABLE WITHOUT STORAGE'); });
    const flushes: Promise<unknown>[] = [];
    act(() => {
      window.dispatchEvent(new CustomEvent('parium:flush-pending-notes-before-sign-out', {
        detail: { waitUntil: (flush: Promise<unknown>) => flushes.push(flush) },
      }));
    });

    expect(flushes).toHaveLength(1);
    await act(async () => { await flushes[0]; });
    expect(rpcCalls).toHaveLength(1);
    expect(result.current.lastSaved).not.toBeNull();
    expect(result.current.saveFailed).toBe(false);
  });

  it('keeps the acknowledged server revision in memory when localStorage writes fail', async () => {
    mockUser = { id: 'u1' };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    act(() => { result.current.handleChange('FIRST ONLINE SAVE'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(rpcCalls.length).toBe(1));

    act(() => { result.current.handleChange('SECOND ONLINE SAVE'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(rpcCalls.length).toBe(2));

    expect(rpcCalls[1]).toEqual({
      p_content: 'SECOND ONLINE SAVE',
      p_expected_revision: 1,
      p_expected_user_id: 'u1',
    });
  });

  it('resolves a conflict in memory even when localStorage is unavailable', async () => {
    mockUser = { id: 'u1' };
    queryImpl = async () => ({
      data: { id: '1', content: 'SERVER V7', revision: 7, updated_at: '2026-08-30T00:00:00.000Z' },
      error: null,
    });
    let call = 0;
    rpcImpl = async (args) => {
      call += 1;
      return call === 1
        ? {
            data: [{
              save_status: 'conflict',
              server_content: 'REMOTE V8',
              server_revision: 8,
              server_updated_at: '2026-08-30T00:01:00.000Z',
            }],
            error: null,
          }
        : savedRpcResult(args);
    };

    const { result } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });

    act(() => { result.current.handleChange('KEEP LOCAL'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(result.current.saveConflict).not.toBeNull());

    act(() => { result.current.overwriteWithLocalVersion(); });
    await waitFor(() => expect(rpcCalls.length).toBe(2));
    expect(rpcCalls[1]).toEqual({
      p_content: 'KEEP LOCAL',
      p_expected_revision: 8,
      p_expected_user_id: 'u1',
    });
  });

  it('flushes a pending edit when logout happens before the debounce', async () => {
    mockUser = { id: 'u1' };
    const fetchSpy = vi.fn((..._args: unknown[]) => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal('fetch', fetchSpy);
    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    await act(async () => { await Promise.resolve(); });

    act(() => { result.current.handleChange('SAVE BEFORE LOGOUT'); });
    mockUser = null;
    rerender();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/save_jobseeker_note`);
    expect(JSON.parse(init.body as string)).toEqual({
      p_content: 'SAVE BEFORE LOGOUT',
      p_expected_revision: 0,
      p_expected_user_id: 'u1',
    });
    expect(init.keepalive).toBe(true);
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
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(rpcCalls.length).toBe(0);

    online = true;
    await act(async () => { connectivityCb?.(true); await Promise.resolve(); vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(rpcCalls.length).toBe(1));
    expect(result.current.content).toBe('OFFLINE PENDING');
  });

  it('StrictMode does not duplicate saves or listeners', async () => {
    mockUser = { id: 'u1' };
    const { result } = renderNotes({ strict: true });
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => { result.current.handleChange('STRICT'); });
    await act(async () => { vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(rpcCalls.length).toBe(1));
    expect(channels.length).toBe(1);
  });

  // ── 7. query metadata must be bound to its own request ──────────────
  it("a late account A query result cannot suppress account B's server row", async () => {
    mockUser = { id: 'a' };
    const qA = deferred<QueryResult>();
    const qB = deferred<QueryResult>();
    let call = 0;
    queryImpl = () => { call += 1; return call === 1 ? qA.promise : qB.promise; };

    const { result, rerender } = renderNotes();
    await waitFor(() => expect(call).toBe(1));

    localStorage.setItem(cleanKey('b'), 'B CACHE');
    mockUser = { id: 'b' };
    rerender();
    await waitFor(() => expect(call).toBe(2));
    expect(result.current.content).toBe('B CACHE');

    // B resolves first, A's stale request completes before effects flush.
    await act(async () => {
      qB.resolve({
        data: { id: '2', content: 'B SERVER', revision: 0, updated_at: '2026-08-30T00:00:00.000Z' },
        error: null,
      });
      await Promise.resolve();
      qA.resolve({
        data: { id: '1', content: 'A SERVER', revision: 0, updated_at: '2026-08-30T00:00:00.000Z' },
        error: null,
      });
      await Promise.resolve();
    });
    await act(async () => { vi.advanceTimersByTime(50); });

    await waitFor(() => expect(result.current.content).toBe('B SERVER'));
    expect(localStorage.getItem(cleanKey('b'))).toBe('B SERVER');
  });

  it("applies B's first server row exactly once after a normal A→B switch", async () => {
    mockUser = { id: 'a' };
    let call = 0;
    queryImpl = async () => {
      call += 1;
      return call === 1
        ? {
            data: { id: '1', content: 'A SERVER', revision: 0, updated_at: '2026-08-30T00:00:00.000Z' },
            error: null,
          }
        : {
            data: { id: '2', content: 'B SERVER', revision: 0, updated_at: '2026-08-30T00:00:00.000Z' },
            error: null,
          };
    };

    const { result, rerender } = renderNotes();
    await waitFor(() => expect(result.current.content).toBe('A SERVER'));

    localStorage.setItem(cleanKey('b'), 'B CACHE');
    mockUser = { id: 'b' };
    rerender();

    await waitFor(() => expect(result.current.content).toBe('B SERVER'));
    expect(localStorage.getItem(cleanKey('b'))).toBe('B SERVER');
    expect(localStorage.getItem(cleanKey('a'))).toBe('A SERVER');
  });

  it('a same-user query started before a local save is still rejected', async () => {
    mockUser = { id: 'u1' };
    localStorage.setItem(revisionKey('u1'), '0');
    const q = deferred<QueryResult>();
    queryImpl = () => q.promise;

    const { result } = renderNotes();
    act(() => { result.current.handleChange('LOCAL B'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(localStorage.getItem(cleanKey('u1'))).toBe('LOCAL B'));

    await act(async () => {
      q.resolve({
        data: { id: '1', content: 'STALE A', revision: 0, updated_at: '2026-08-30T00:00:00.000Z' },
        error: null,
      });
      await Promise.resolve();
    });
    await act(async () => { vi.advanceTimersByTime(50); });

    expect(result.current.content).toBe('LOCAL B');
    expect(localStorage.getItem(cleanKey('u1'))).toBe('LOCAL B');
  });
});
