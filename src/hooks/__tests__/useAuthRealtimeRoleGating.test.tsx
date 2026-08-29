/**
 * Regression: AuthProvider realtime role gating.
 *
 * Employer-only realtime channels (auth-job-count, auth-employer-applications,
 * auth-reviews, auth-my-candidates) must only be registered for users whose
 * resolved role is "employer". Jobseekers must only get their user-scoped
 * channels (auth-saved-jobs, auth-applications).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mutable per-test state (hoisted so module mocks can read it)
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({
  currentRole: 'job_seeker' as 'job_seeker' | 'employer',
  userId: 'user-under-test',
  channelNames: [] as string[],
  registrations: [] as Array<{
    channel: string;
    event: string;
    schema?: string;
    table?: string;
    filter?: string;
  }>,
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

// Import AFTER mocks
import { AuthProvider } from '@/hooks/useAuth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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
  // Wait until the realtime effect for the signed-in user has run
  await waitFor(
    () => {
      expect(h.channelNames).toContain(`auth-saved-jobs-${h.userId}`);
    },
    { timeout: 5000 }
  );
};

describe('AuthProvider realtime role gating', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    h.channelNames.length = 0;
    h.registrations.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it('jobseeker: employer-only channels are NOT created, user-scoped channels are', async () => {
    h.currentRole = 'job_seeker';
    h.userId = 'jobseeker-1';
    await renderAuthProvider();

    // Employer-only channels must not exist for a jobseeker
    expect(h.channelNames).not.toContain(`auth-job-count-${h.userId}`);
    expect(h.channelNames).not.toContain(`auth-employer-applications-${h.userId}`);
    expect(h.channelNames).not.toContain(`auth-reviews-${h.userId}`);
    expect(h.channelNames).not.toContain(`auth-my-candidates-${h.userId}`);

    // User-scoped jobseeker channels must exist
    expect(h.channelNames).toContain(`auth-saved-jobs-${h.userId}`);
    expect(h.channelNames).toContain(`auth-applications-${h.userId}`);

    const savedReg = h.registrations.find(
      (r) => r.channel === `auth-saved-jobs-${h.userId}` && r.table === 'saved_jobs'
    );
    expect(savedReg?.filter).toBe(`user_id=eq.${h.userId}`);

    const appsReg = h.registrations.find(
      (r) => r.channel === `auth-applications-${h.userId}` && r.table === 'job_applications'
    );
    expect(appsReg?.filter).toBe(`applicant_id=eq.${h.userId}`);
  });

  it('employer: all four employer-only channels ARE created', async () => {
    h.currentRole = 'employer';
    h.userId = 'employer-1';
    await renderAuthProvider();

    expect(h.channelNames).toContain(`auth-job-count-${h.userId}`);
    expect(h.channelNames).toContain(`auth-employer-applications-${h.userId}`);
    expect(h.channelNames).toContain(`auth-reviews-${h.userId}`);
    expect(h.channelNames).toContain(`auth-my-candidates-${h.userId}`);
  });

  it('jobseeker: auth-applications has exactly one job_applications registration, user-filtered', async () => {
    // job_applications is REPLICA IDENTITY FULL, so the single applicant-filtered
    // registration already covers DELETE payloads. A second unfiltered global
    // DELETE registration is redundant 250k-user fanout and must not exist.
    h.currentRole = 'job_seeker';
    h.userId = 'jobseeker-1';
    await renderAuthProvider();

    const appRegs = h.registrations.filter(
      (r) => r.channel === `auth-applications-${h.userId}` && r.table === 'job_applications'
    );

    // Exactly one registration total on the channel for job_applications
    expect(appRegs).toHaveLength(1);

    // Every registration must carry the applicant filter — no unfiltered global fanout
    for (const reg of appRegs) {
      expect(reg.filter).toBe(`applicant_id=eq.${h.userId}`);
    }
  });
});
