import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

/**
 * Enhetstester för jobbsökarens extraprofiler:
 * - maxgränsen (3 profiler totalt = 2 extra)
 * - standardprofil flyttas när den som är standard tas bort
 * - filer raderas aldrig direkt vid borttagning
 */

type Row = Record<string, unknown>;

const state: {
  rows: Row[];
  inserted: Row[];
  updates: Array<{ patch: Row; filters: Array<[string, string, unknown]> }>;
  deletedIds: string[];
  removedPaths: string[];
} = { rows: [], inserted: [], updates: [], deletedIds: [], removedPaths: [] };

function makeBuilder(op: 'select' | 'insert' | 'update' | 'delete', patch: Row = {}) {
  const filters: Array<[string, string, unknown]> = [];
  const builder: any = {
    select: () => builder,
    eq: (col: string, val: unknown) => { filters.push(['eq', col, val]); return builder; },
    neq: (col: string, val: unknown) => { filters.push(['neq', col, val]); return builder; },
    is: () => builder,
    order: () => builder,
    single: () => {
      const row = { id: `new-${state.inserted.length}`, ...patch };
      state.inserted.push(row);
      return Promise.resolve({ data: row, error: null });
    },
    then: (resolve: (v: unknown) => unknown) => {
      if (op === 'update') state.updates.push({ patch, filters });
      if (op === 'delete') {
        const idFilter = filters.find(([, col]) => col === 'id');
        if (idFilter) state.deletedIds.push(String(idFilter[2]));
      }
      const data = op === 'select' ? state.rows : null;
      return Promise.resolve(resolve({ data, error: null }));
    },
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => makeBuilder('select'),
      insert: (patch: Row) => makeBuilder('insert', patch),
      update: (patch: Row) => makeBuilder('update', patch),
      delete: () => makeBuilder('delete'),
    }),
    storage: {
      from: () => ({
        remove: (paths: string[]) => {
          state.removedPaths.push(...paths);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    },
  },
}));

const { useCandidateProfiles, MAX_CANDIDATE_PROFILES, MAX_EXTRA_CANDIDATE_PROFILES } =
  await import('@/hooks/useCandidateProfiles');

function profile(id: string, extra: Row = {}): Row {
  return {
    id,
    user_id: 'u1',
    label: id,
    cv_url: null,
    cv_filename: null,
    video_url: null,
    profile_image_url: null,
    cover_image_url: null,
    is_default: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  state.rows = [];
  state.inserted = [];
  state.updates = [];
  state.deletedIds = [];
  state.removedPaths = [];
});

describe('useCandidateProfiles', () => {
  it('tillåter max 3 profiler totalt (2 extra utöver grundprofilen)', () => {
    expect(MAX_CANDIDATE_PROFILES).toBe(3);
    expect(MAX_EXTRA_CANDIDATE_PROFILES).toBe(2);
  });

  it('återanvänder kontospecifik profilmetadata direkt vid återmontering', async () => {
    state.rows = [profile('cached', { is_default: true, profile_image_url: 'u1/profile.jpg' })];
    const first = renderHook(() => useCandidateProfiles('u1'));
    await waitFor(() => expect(first.result.current.profiles).toHaveLength(1));
    first.unmount();

    state.rows = [];
    const second = renderHook(() => useCandidateProfiles('u1'));
    expect(second.result.current.profiles[0]?.id).toBe('cached');
    expect(second.result.current.profiles[0]?.profile_image_url).toBe('u1/profile.jpg');
  });

  it('nekar en ny profil när maxgränsen är nådd', async () => {
    state.rows = [profile('a'), profile('b')];
    const { result } = renderHook(() => useCandidateProfiles('u1'));
    await waitFor(() => expect(result.current.profiles).toHaveLength(2));
    expect(result.current.canCreateMore).toBe(false);

    let res: any;
    await act(async () => { res = await result.current.createProfile({ label: 'c' }); });
    expect(res.error).toContain('max 3 profiler');
    expect(state.inserted).toHaveLength(0);
  });

  it('sätter första profilen som standard och ger nästa sort_order', async () => {
    const { result } = renderHook(() => useCandidateProfiles('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.createProfile({ label: '  Lager  ' }); });
    expect(state.inserted[0]).toMatchObject({ label: 'Lager', is_default: true, sort_order: 0 });
  });

  it('utser en ny standardprofil när standarden tas bort', async () => {
    state.rows = [profile('a', { is_default: true }), profile('b')];
    const { result } = renderHook(() => useCandidateProfiles('u1'));
    await waitFor(() => expect(result.current.profiles).toHaveLength(2));

    await act(async () => { await result.current.deleteProfile('a'); });
    expect(state.deletedIds).toContain('a');
    const promoted = state.updates.find(u => u.patch.is_default === true);
    expect(promoted?.filters).toContainEqual(['eq', 'id', 'b']);
  });

  it('lämnar profilens filer till referenssäker backendstädning', async () => {
    state.rows = [profile('a', { video_url: 'u1/clip.mp4', profile_image_url: 'u1/img.jpg?v=2' })];
    const { result } = renderHook(() => useCandidateProfiles('u1'));
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));

    await act(async () => { await result.current.deleteProfile('a'); });
    expect(state.removedPaths).toEqual([]);
  });

  it('rensar övriga standarder när en ny standard sätts', async () => {
    state.rows = [profile('a', { is_default: true }), profile('b')];
    const { result } = renderHook(() => useCandidateProfiles('u1'));
    await waitFor(() => expect(result.current.profiles).toHaveLength(2));

    await act(async () => { await result.current.setDefaultProfile('b'); });
    const cleared = state.updates.find(u => u.patch.is_default === false);
    expect(cleared?.filters).toContainEqual(['neq', 'id', 'b']);
    const set = state.updates.find(u => u.patch.is_default === true);
    expect(set?.filters).toContainEqual(['eq', 'id', 'b']);
  });
});
