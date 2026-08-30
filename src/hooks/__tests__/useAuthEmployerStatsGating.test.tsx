/**
 * Regression: employer-only RPC gating in AuthProvider's initial load.
 *
 * refreshEmployerStats must be fail-closed: no employer-only RPC may run
 * unless there is a current user AND the resolved userRole belongs to that
 * exact user AND its role is exactly the canonical employer value.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mutable per-test state (hoisted so module mocks can read it)
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({
  currentRole: 'job_seeker' as string | null,
  userId: 'user-under-test',
  channelNames: [] as string[],
  registrations: [] as Array<{
    channel: string;
    event: string;
    schema?: string;
    table?: string;
    filter?: string;
  }>,
  rpcCalls: [] as Array<{ name: string; args: unknown }>,
}));

// ---------------------------------------------------------------------------
// Narrow dependency mocks — record realtime, stub everything else
// ---------------------------------------------------------------------------
interface MockChannel {
  on: (
    event: string,
    opts?: { schema?: string; table?: string; filter?: string }
  ) => MockChannel;
  subscribe: () => MockChannel;
}

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: (name: string) => {
    h.channelNames.push(name);
    const channel: MockChannel = {
      on: (event, opts) => {
        h.registrations.push({
          channel: name,
          event,
          schema: opts?.schema,
          table: opts?.table,
          filter: opts?.filter,
        });
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  interface ListResult {
    data: unknown;
    error: null | { message: string };
  }
  const makeQuery = (listResult: ListResult) => {
    const q = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      in: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (
        onF?: ((value: ListResult) => unknown) | null,
        onR?: ((reason: unknown) => unknown) | null
      ) => Promise.resolve(listResult).then(onF ?? undefined, onR ?? undefined),
    };
    return q;
  };

  const supabase = {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: {
            session: {
              user: { id: h.userId, email: 'test@example.com' },
              access_token: 'token',
            },
          },
          error: null,
        }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: () => Promise.resolve({ error: null }),
    },
    rpc: (name: string, args?: unknown) => {
      h.rpcCalls.push({ name, args });
      if (name === 'get_my_profile') {
        return Promise.resolve({
          data: [
            {
              id: `profile-${h.userId}`,
              user_id: h.userId,
              role: h.currentRole ?? undefined,
              first_name: 'Test',
              interests: [],
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      if (table === 'user_roles') {
        return makeQuery({
          data: [
            {
              id: `role-${h.userId}`,
              user_id: h.userId,
              role: h.currentRole,
              organization_id: null,
              is_active: true,
            },
          ],
          error: null,
        });
      }
      return makeQuery({ data: [], error: null });
    },
    removeChannel: () => Promise.resolve('ok' as const),
    realtime: { isConnected: () => true },
  };

  return { supabase };
});

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn(), toasts: [], dismiss: vi.fn() }),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    dismiss: vi.fn(),
  }),
}));
vi.mock('@/lib/mediaManager', () => ({ getMediaUrl: vi.fn(async () => null) }));
vi.mock('@/hooks/useMediaUrl', () => ({
  clearMediaUrlCache: vi.fn(),
  prefetchMediaUrl: vi.fn(async () => null),
}));
vi.mock('@/hooks/useInactivityTimeout', () => ({
  useInactivityTimeout: vi.fn(),
  isInactivityLogout: vi.fn(() => false),
  clearInactivityLogoutFlag: vi.fn(),
}));
vi.mock('@/lib/authStorage', () => ({
  authStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  isInactivityLogoutFromStorage: vi.fn(() => false),
  clearInactivityLogoutFromStorage: vi.fn(),
  claimAuthSnapshotOwnership: vi.fn(),
}));
vi.mock('@/hooks/useWeather', () => ({
  preloadWeatherLocation: vi.fn(async () => undefined),
}));
vi.mock('@/hooks/useFormDraft', () => ({ clearAllDrafts: vi.fn() }));
vi.mock('@/hooks/useEagerRatingsPreload', () => ({
  triggerBackgroundSync: vi.fn(async () => undefined),
  clearAllAppCaches: vi.fn(),
}));
vi.mock('@/lib/authSplashEvents', () => ({
  authSplashEvents: { show: vi.fn(), hide: vi.fn() },
  cacheAuthRoleForEmail: vi.fn(),
  getCachedAuthRoleForEmail: vi.fn(() => null),
  normalizeAuthSplashRole: vi.fn((r: unknown) => r ?? null),
}));
vi.mock('@/lib/connectivityManager', () => ({
  forceConnectivityCheck: vi.fn(async () => true),
  getIsOnline: vi.fn(() => true),
  onConnectivityChange: vi.fn(() => () => {}),
}));
vi.mock('@/hooks/useSessionManager', () => ({
  useSessionManager: vi.fn(() => ({ removeSession: vi.fn() })),
  clearSessionToken: vi.fn(),
  beginSignOutTracking: vi.fn(),
  endSignOutTracking: vi.fn(),
}));
vi.mock('@/hooks/useJobPrefetchCache', () => ({
  patchPrefetchedJobsByEmployer: vi.fn(),
}));
vi.mock('@/lib/companyLogoUrl', () => ({
  resolveCompanyLogoUrl: vi.fn(() => null),
}));

// Import AFTER mocks
import { AuthProvider, canRefreshEmployerStats } from '@/hooks/useAuth';

const EMPLOYER_ONLY_RPCS = [
  'get_employer_jobs_counts',
  'get_employer_dashboard_stats',
  'count_distinct_candidates_scoped',
  'count_distinct_my_candidates',
];

const employerRpcCalls = () =>
  h.rpcCalls.filter((c) => EMPLOYER_ONLY_RPCS.includes(c.name));

const renderAuthProvider = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div />
      </AuthProvider>
    </QueryClientProvider>
  );
  await waitFor(
    () => {
      expect(h.rpcCalls.some((c) => c.name === 'get_my_profile')).toBe(true);
    },
    { timeout: 5000 }
  );
  // Give the initial-load effect time to fire any (unwanted) employer RPCs
  await new Promise((r) => setTimeout(r, 250));
};

describe('AuthProvider employer-stats RPC gating', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    h.channelNames.length = 0;
    h.registrations.length = 0;
    h.rpcCalls.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it('jobseeker: zero employer-only RPCs on initial authenticated load', async () => {
    h.currentRole = 'job_seeker';
    h.userId = 'jobseeker-1';
    await renderAuthProvider();

    expect(employerRpcCalls().map((c) => c.name)).toEqual([]);
  });

  it('unresolved/malformed/unknown role: zero employer-only RPCs', async () => {
    h.currentRole = null;
    h.userId = 'unknown-role-1';
    await renderAuthProvider();
    expect(employerRpcCalls().map((c) => c.name)).toEqual([]);

    cleanup();
    h.rpcCalls.length = 0;
    h.currentRole = 'not_a_real_role';
    h.userId = 'unknown-role-2';
    await renderAuthProvider();
    expect(employerRpcCalls().map((c) => c.name)).toEqual([]);
  });

  it('stale employer role from another account is denied (fail-closed guard)', () => {
    const currentUser = { id: 'user-b' } as { id: string };
    const staleEmployerRole = {
      id: 'role-a',
      user_id: 'user-a',
      role: 'employer' as const,
      is_active: true,
    };

    expect(canRefreshEmployerStats(currentUser, staleEmployerRole)).toBe(false);
    expect(canRefreshEmployerStats(null, staleEmployerRole)).toBe(false);
    expect(
      canRefreshEmployerStats(currentUser, {
        ...staleEmployerRole,
        user_id: 'user-b',
      })
    ).toBe(true);
    expect(
      canRefreshEmployerStats(currentUser, {
        ...staleEmployerRole,
        user_id: 'user-b',
        role: 'job_seeker',
      })
    ).toBe(false);
    expect(canRefreshEmployerStats(currentUser, null)).toBe(false);
  });

  it('employer: existing RPC names, counts and arguments are preserved', async () => {
    h.currentRole = 'employer';
    h.userId = 'employer-1';
    await renderAuthProvider();

    const calls = employerRpcCalls();
    const jobCounts = calls.filter((c) => c.name === 'get_employer_jobs_counts');
    expect(jobCounts).toHaveLength(2);
    expect(jobCounts.map((c) => (c.args as { p_scope: string }).p_scope).sort()).toEqual([
      'organization',
      'personal',
    ]);

    const dash = calls.filter((c) => c.name === 'get_employer_dashboard_stats');
    expect(dash).toHaveLength(1);
    expect(dash[0].args).toEqual({ p_scope: 'organization' });

    const scoped = calls.filter((c) => c.name === 'count_distinct_candidates_scoped');
    expect(scoped).toHaveLength(1);
    expect(scoped[0].args).toEqual({ p_scope: 'organization' });

    await waitFor(
      () => {
        expect(
          calls.length +
            employerRpcCalls().filter((c) => c.name === 'count_distinct_my_candidates').length
        ).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );
    const mine = employerRpcCalls().filter(
      (c) => c.name === 'count_distinct_my_candidates'
    );
    expect(mine.length).toBeGreaterThanOrEqual(1);
    expect(mine[0].args).toEqual({ p_recruiter_id: h.userId });
  });
});
