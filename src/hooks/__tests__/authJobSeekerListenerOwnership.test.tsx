/**
 * RED → GREEN: AuthProvider är enda globala ägaren av jobbsökarens
 * användarfiltrerade saved_jobs/job_applications-realtime.
 *
 * Krav:
 *  - job_seeker: exakt EN filtrerad saved-lyssnare och EN filtrerad apps-lyssnare
 *  - en burst från båda koalesceras till EN invalidering av exakt
 *    ['jobseeker-dashboard-stats', user.id] — aldrig den breda nyckeln
 *  - gamla konto-A-callbacks är inerta efter kontobyte
 *  - inga sådana jobbsökarlyssnare för annan roll
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Cb = (payload: unknown) => void;

const h = vi.hoisted(() => ({
  currentRole: 'job_seeker' as 'job_seeker' | 'employer',
  userId: 'jobseeker-1',
  channelNames: [] as string[],
  registrations: [] as Array<{
    channel: string;
    table?: string;
    filter?: string;
    cb?: (payload: unknown) => void;
  }>,
}));

interface MockChannel {
  on: (
    event: string,
    opts?: { schema?: string; table?: string; filter?: string },
    cb?: Cb,
  ) => MockChannel;
  subscribe: (cb?: (status: string) => void) => MockChannel;
}

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: (name: string) => {
    h.channelNames.push(name);
    const channel: MockChannel = {
      on: (_event, opts, cb) => {
        h.registrations.push({
          channel: name,
          table: opts?.table,
          filter: opts?.filter,
          cb,
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
        onR?: ((reason: unknown) => unknown) | null,
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
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    rpc: (name: string) => {
      if (name === 'get_my_profile') {
        return Promise.resolve({
          data: [
            {
              id: `profile-${h.userId}`,
              user_id: h.userId,
              role: h.currentRole,
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

import { AuthProvider } from '@/hooks/useAuth';

const renderAuthProvider = async (client: QueryClient) => {
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <div />
      </AuthProvider>
    </QueryClientProvider>,
  );
  if (h.currentRole === 'job_seeker') {
    await waitFor(() => expect(h.channelNames).toContain(`auth-saved-jobs-${h.userId}`), {
      timeout: 5000,
    });
  } else {
    await waitFor(() => expect(h.channelNames).toContain(`auth-reviews-${h.userId}`), {
      timeout: 5000,
    });
  }
};

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const jobseekerRegs = (userId: string) =>
  h.registrations.filter(
    (r) =>
      (r.table === 'saved_jobs' && r.filter === `user_id=eq.${userId}`) ||
      (r.table === 'job_applications' && r.filter === `applicant_id=eq.${userId}`),
  );

describe('AuthProvider — jobbsökarens saved/app-lyssnarägarskap', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    h.channelNames.length = 0;
    h.registrations.length = 0;
    h.currentRole = 'job_seeker';
    h.userId = 'jobseeker-1';
  });

  afterEach(() => cleanup());

  it('job_seeker: exakt en filtrerad saved-lyssnare och en filtrerad apps-lyssnare', async () => {
    await renderAuthProvider(newClient());

    const saved = h.registrations.filter((r) => r.table === 'saved_jobs');
    const apps = h.registrations.filter((r) => r.table === 'job_applications');
    expect(saved).toHaveLength(1);
    expect(saved[0].filter).toBe('user_id=eq.jobseeker-1');
    expect(apps).toHaveLength(1);
    expect(apps[0].filter).toBe('applicant_id=eq.jobseeker-1');
  });

  it('burst från båda lyssnarna koalesceras till EN user-scopad invalidering', async () => {
    const client = newClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    await renderAuthProvider(client);
    spy.mockClear();

    const regs = jobseekerRegs('jobseeker-1');
    expect(regs).toHaveLength(2);

    await act(async () => {
      regs.forEach((r) => r.cb?.({}));
      regs.forEach((r) => r.cb?.({}));
      await new Promise((res) => setTimeout(res, 2500));
    });

    const statsCalls = spy.mock.calls.filter((c) => {
      const key = (c[0] as { queryKey?: unknown[] })?.queryKey;
      return Array.isArray(key) && key[0] === 'jobseeker-dashboard-stats';
    });
    expect(statsCalls).toHaveLength(1);
    expect((statsCalls[0][0] as { queryKey: unknown[] }).queryKey).toEqual([
      'jobseeker-dashboard-stats',
      'jobseeker-1',
    ]);
  });

  it('gamla konto-A-callbacks invaliderar inte efter kontobyte till B', async () => {
    await renderAuthProvider(newClient());
    const staleCallbacks = jobseekerRegs('jobseeker-1').map((r) => r.cb);
    expect(staleCallbacks).toHaveLength(2);

    cleanup();
    h.channelNames.length = 0;
    h.registrations.length = 0;
    h.userId = 'jobseeker-2';

    const clientB = newClient();
    await renderAuthProvider(clientB);
    const spyB = vi.spyOn(clientB, 'invalidateQueries');

    await act(async () => {
      staleCallbacks.forEach((cb) => cb?.({}));
      await new Promise((res) => setTimeout(res, 2500));
    });

    const statsCalls = spyB.mock.calls.filter((c) => {
      const key = (c[0] as { queryKey?: unknown[] })?.queryKey;
      return Array.isArray(key) && key[0] === 'jobseeker-dashboard-stats';
    });
    expect(statsCalls).toHaveLength(0);
  });

  it('employer: inga jobbsökarlyssnare för saved_jobs/job_applications-filter', async () => {
    h.currentRole = 'employer';
    h.userId = 'employer-1';
    await renderAuthProvider(newClient());

    expect(h.channelNames).not.toContain('auth-saved-jobs-employer-1');
    expect(h.registrations.filter((r) => r.table === 'saved_jobs')).toHaveLength(0);
    expect(
      h.registrations.filter(
        (r) => r.table === 'job_applications' && r.filter === 'applicant_id=eq.employer-1',
      ),
    ).toHaveLength(0);
  });
});
