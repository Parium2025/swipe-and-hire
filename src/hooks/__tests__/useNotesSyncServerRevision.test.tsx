/**
 * RED contract — jobseeker note writes must use a server-owned revision.
 *
 * The RPC is the compare-and-set boundary. A client may acknowledge its local
 * journal only when the server reports `saved` or `already_saved`; a conflict
 * must retain the journal and expose the competing server snapshot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const CACHE_PREFIX = 'jobseeker_notes_cache_revision_contract';
const USER_ID = 'user-revision-test';
const CLEAN_KEY = `${CACHE_PREFIX}_${USER_ID}`;
const PENDING_KEY = `${CLEAN_KEY}__pending`;
const REVISION_KEY = `${CLEAN_KEY}__revision`;

let selectedColumns: string[] = [];
let queryRow: {
  id: string;
  content: string;
  revision: number;
  updated_at: string;
} | null = null;
let queryImpl: () => Promise<{ data: typeof queryRow; error: null }>;
let rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
let upsertCalls: unknown[] = [];
let rpcImpl: () => Promise<{ data: unknown; error: unknown }>;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: USER_ID } }),
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
    select: (columns: string) => {
      selectedColumns.push(columns);
      return builder;
    },
    eq: () => builder,
    maybeSingle: () => queryImpl(),
    upsert: async (row: unknown) => {
      upsertCalls.push(row);
      return { error: null as null };
    },
  };

  return {
    supabase: {
      from: () => builder,
      rpc: (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        return rpcImpl();
      },
      removeChannel: () => {},
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'revision-test-token' } },
        }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
    },
  };
});

import { useNotesSync } from '@/hooks/useNotesSync';

function renderJobseekerNotes() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(
    () =>
      useNotesSync({
        table: 'jobseeker_notes',
        ownerColumn: 'user_id',
        cachePrefix: CACHE_PREFIX,
        queryKey: 'jobseeker-note-revision-contract',
      }),
    { wrapper }
  );
}

async function passSaveDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(1_500);
    await Promise.resolve();
  });
}

const rpcRow = (
  saveStatus: 'saved' | 'already_saved' | 'conflict',
  overrides: Partial<{
    note_id: string;
    server_content: string;
    server_revision: number;
    server_updated_at: string;
  }> = {}
) => ({
  save_status: saveStatus,
  note_id: 'note-1',
  server_content: 'LOCAL EDIT',
  server_revision: 8,
  server_updated_at: '2026-08-30T10:01:00.000Z',
  ...overrides,
});

describe('useNotesSync — jobseeker server revision contract', () => {
  beforeEach(() => {
    localStorage.clear();
    selectedColumns = [];
    rpcCalls = [];
    upsertCalls = [];
    queryRow = {
      id: 'note-1',
      content: 'SERVER V7',
      revision: 7,
      updated_at: '2026-08-30T10:00:00.000Z',
    };
    queryImpl = async () => ({ data: queryRow, error: null });
    rpcImpl = async () => ({ data: [rpcRow('saved')], error: null });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads the server revision and timestamp with the note snapshot', async () => {
    const { result } = renderJobseekerNotes();

    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(selectedColumns).toContain('id, content, revision, updated_at');
  });

  it('saves jobseeker notes through save_jobseeker_note with the expected revision', async () => {
    const { result } = renderJobseekerNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    act(() => result.current.handleChange('LOCAL EDIT'));
    await passSaveDebounce();
    await waitFor(() => expect(rpcCalls).toHaveLength(1));

    expect(rpcCalls[0]).toEqual({
      fn: 'save_jobseeker_note',
      args: {
        p_content: 'LOCAL EDIT',
        p_expected_revision: 7,
        p_expected_user_id: USER_ID,
      },
    });
    expect(upsertCalls).toEqual([]);
  });

  it('automatically drains an edit made before the server revision baseline arrives', async () => {
    localStorage.setItem(CLEAN_KEY, 'SERVER V7');
    let resolveQuery!: (value: { data: typeof queryRow; error: null }) => void;
    queryImpl = () => new Promise((resolve) => {
      resolveQuery = resolve;
    });

    const { result } = renderJobseekerNotes();
    act(() => result.current.handleChange('EARLY LOCAL EDIT'));
    await passSaveDebounce();
    expect(rpcCalls).toHaveLength(0);

    await act(async () => {
      resolveQuery({ data: queryRow, error: null });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.isFetched).toBe(true));
    await waitFor(() => expect(rpcCalls).toHaveLength(1));
    expect(rpcCalls[0].args).toEqual({
      p_content: 'EARLY LOCAL EDIT',
      p_expected_revision: 7,
      p_expected_user_id: USER_ID,
    });
  });

  it('retains the pending journal and exposes the server snapshot on conflict', async () => {
    rpcImpl = async () => ({
      data: [
        rpcRow('conflict', {
          server_content: 'REMOTE EDIT',
          server_revision: 8,
          server_updated_at: '2026-08-30T10:02:00.000Z',
        }),
      ],
      error: null,
    });
    const { result } = renderJobseekerNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    act(() => result.current.handleChange('LOCAL EDIT'));
    await passSaveDebounce();
    await waitFor(() => expect(rpcCalls).toHaveLength(1));

    expect(JSON.parse(localStorage.getItem(PENDING_KEY)!)).toMatchObject({
      u: USER_ID,
      c: 'LOCAL EDIT',
    });
    expect(localStorage.getItem(CLEAN_KEY)).toBe('SERVER V7');
    expect(result.current.lastSaved).toBeNull();
    expect(result.current.saveConflict).toEqual({
      serverContent: 'REMOTE EDIT',
      serverRevision: 8,
      serverUpdatedAt: '2026-08-30T10:02:00.000Z',
    });
  });

  it('acknowledges already_saved and adopts the returned server revision', async () => {
    rpcImpl = async () => ({
      data: [rpcRow('already_saved', { server_revision: 8 })],
      error: null,
    });
    const { result } = renderJobseekerNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    act(() => result.current.handleChange('LOCAL EDIT'));
    await passSaveDebounce();
    await waitFor(() => expect(rpcCalls).toHaveLength(1));
    await waitFor(() => expect(localStorage.getItem(PENDING_KEY)).toBeNull());

    expect(localStorage.getItem(CLEAN_KEY)).toBe('LOCAL EDIT');
    expect(result.current.saveFailed).toBe(false);
    expect(result.current.saveConflict).toBeNull();
    expect(result.current.lastSaved).toBeInstanceOf(Date);

    rpcCalls = [];
    rpcImpl = async () => ({
      data: [rpcRow('saved', { server_content: 'NEXT EDIT', server_revision: 9 })],
      error: null,
    });
    act(() => result.current.handleChange('NEXT EDIT'));
    await passSaveDebounce();
    await waitFor(() => expect(rpcCalls).toHaveLength(1));
    expect(rpcCalls[0].args).toEqual({
      p_content: 'NEXT EDIT',
      p_expected_revision: 8,
      p_expected_user_id: USER_ID,
    });
  });

  it('lets the user explicitly accept the competing server version', async () => {
    rpcImpl = async () => ({
      data: [rpcRow('conflict', {
        server_content: 'REMOTE EDIT',
        server_revision: 8,
      })],
      error: null,
    });
    const { result } = renderJobseekerNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => result.current.handleChange('LOCAL EDIT'));
    await passSaveDebounce();
    await waitFor(() => expect(result.current.saveConflict).not.toBeNull());

    act(() => result.current.acceptServerVersion());

    expect(result.current.content).toBe('REMOTE EDIT');
    expect(localStorage.getItem(CLEAN_KEY)).toBe('REMOTE EDIT');
    expect(localStorage.getItem(REVISION_KEY)).toBe('8');
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(result.current.saveConflict).toBeNull();
  });

  it('keeps the conflict intact when the pending journal cannot be removed', async () => {
    rpcImpl = async () => ({
      data: [rpcRow('conflict', {
        server_content: 'REMOTE EDIT',
        server_revision: 8,
        server_updated_at: '2026-08-30T10:02:00.000Z',
      })],
      error: null,
    });
    const { result } = renderJobseekerNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => result.current.handleChange('LOCAL EDIT'));
    await passSaveDebounce();
    await waitFor(() => expect(result.current.saveConflict).not.toBeNull());

    const realRemoveItem = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key: string) {
      if (key === PENDING_KEY) throw new Error('remove denied');
      return realRemoveItem.call(this, key);
    });
    act(() => result.current.acceptServerVersion());

    expect(result.current.content).toBe('LOCAL EDIT');
    expect(result.current.saveConflict?.serverContent).toBe('REMOTE EDIT');
    expect(result.current.saveFailed).toBe(true);
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();
    expect(localStorage.getItem(CLEAN_KEY)).toBe('SERVER V7');
    expect(localStorage.getItem(REVISION_KEY)).toBe('7');
  });

  it('lets the user explicitly rebase and keep the local version', async () => {
    let call = 0;
    rpcImpl = async () => {
      call += 1;
      return call === 1
        ? {
            data: [rpcRow('conflict', {
              server_content: 'REMOTE EDIT',
              server_revision: 8,
            })],
            error: null,
          }
        : {
            data: [rpcRow('saved', {
              server_content: 'LOCAL EDIT',
              server_revision: 9,
            })],
            error: null,
          };
    };
    const { result } = renderJobseekerNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    act(() => result.current.handleChange('LOCAL EDIT'));
    await passSaveDebounce();
    await waitFor(() => expect(result.current.saveConflict).not.toBeNull());

    act(() => result.current.overwriteWithLocalVersion());
    await waitFor(() => expect(rpcCalls).toHaveLength(2));
    await waitFor(() => expect(localStorage.getItem(PENDING_KEY)).toBeNull());

    expect(rpcCalls[1].args).toEqual({
      p_content: 'LOCAL EDIT',
      p_expected_revision: 8,
      p_expected_user_id: USER_ID,
    });
    expect(localStorage.getItem(CLEAN_KEY)).toBe('LOCAL EDIT');
    expect(localStorage.getItem(REVISION_KEY)).toBe('9');
    expect(result.current.saveConflict).toBeNull();
  });

  it('flushes beforeunload through the revision RPC endpoint with expected revision', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(null, { status: 204 })
    );
    vi.stubGlobal('fetch', fetchSpy);
    const { result } = renderJobseekerNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.handleChange('LOCAL EDIT'));
    act(() => window.dispatchEvent(new Event('beforeunload')));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/save_jobseeker_note`
    );
    expect(init).toMatchObject({ method: 'POST', keepalive: true });
    expect(JSON.parse(init.body as string)).toEqual({
      p_content: 'LOCAL EDIT',
      p_expected_revision: 7,
      p_expected_user_id: USER_ID,
    });
  });

  it('acknowledges a pending journal when a successful unload already saved the same content', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const first = renderJobseekerNotes();
    await waitFor(() => expect(first.result.current.isFetched).toBe(true));
    await act(async () => { await Promise.resolve(); });

    act(() => first.result.current.handleChange('SAVED DURING UNLOAD'));
    act(() => window.dispatchEvent(new Event('beforeunload')));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    first.unmount();

    queryRow = {
      id: 'note-1',
      content: 'SAVED DURING UNLOAD',
      revision: 8,
      updated_at: '2026-08-30T10:03:00.000Z',
    };
    const second = renderJobseekerNotes();
    await waitFor(() => expect(second.result.current.isFetched).toBe(true));
    await waitFor(() => expect(second.result.current.saveConflict).toBeNull());

    expect(second.result.current.content).toBe('SAVED DURING UNLOAD');
    expect(localStorage.getItem(CLEAN_KEY)).toBe('SAVED DURING UNLOAD');
    expect(localStorage.getItem(REVISION_KEY)).toBe('8');
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(rpcCalls).toEqual([]);
  });

  it('surfaces a conflict when an edit precedes an unknown server baseline', async () => {
    let resolveQuery!: (value: { data: typeof queryRow; error: null }) => void;
    queryImpl = () => new Promise((resolve) => { resolveQuery = resolve; });
    localStorage.setItem(CLEAN_KEY, 'LOCAL BASE');

    const { result } = renderJobseekerNotes();
    act(() => result.current.handleChange('LOCAL EDIT BEFORE QUERY'));

    await act(async () => {
      resolveQuery({ data: queryRow, error: null });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.saveConflict).toEqual({
      serverContent: 'SERVER V7',
      serverRevision: 7,
      serverUpdatedAt: '2026-08-30T10:00:00.000Z',
    }));
    expect(result.current.content).toBe('LOCAL EDIT BEFORE QUERY');
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();
  });

  it('adopts a clean cross-tab revision before the next edit', async () => {
    const { result } = renderJobseekerNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: `${CLEAN_KEY}__revision`,
        newValue: '8',
      }));
      result.current.handleChange('AFTER OTHER TAB');
    });
    rpcImpl = async () => ({
      data: [rpcRow('saved', { server_content: 'AFTER OTHER TAB', server_revision: 9 })],
      error: null,
    });
    await passSaveDebounce();
    await waitFor(() => expect(rpcCalls).toHaveLength(1));

    expect(rpcCalls[0].args).toEqual({
      p_content: 'AFTER OTHER TAB',
      p_expected_revision: 8,
      p_expected_user_id: USER_ID,
    });
  });

  it('ignores a removed cross-tab revision key instead of coercing null to revision zero', async () => {
    const { result } = renderJobseekerNotes();
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: REVISION_KEY,
        newValue: null,
      }));
      result.current.handleChange('AFTER CACHE CLEANUP');
    });
    rpcImpl = async () => ({
      data: [rpcRow('saved', { server_content: 'AFTER CACHE CLEANUP', server_revision: 8 })],
      error: null,
    });
    await passSaveDebounce();
    await waitFor(() => expect(rpcCalls).toHaveLength(1));

    expect(rpcCalls[0].args).toEqual({
      p_content: 'AFTER CACHE CLEANUP',
      p_expected_revision: 7,
      p_expected_user_id: USER_ID,
    });
  });
});
