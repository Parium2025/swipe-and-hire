/**
 * RED → GREEN: kontobunden auktoritet i AuthProvider.
 *
 * P1-1: en kvarhängande roll från konto A får inte skapa jobbsökarlyssnare
 *       för konto B. Rollen måste ägas av exakt den inloggade användaren.
 * P1-2: en redan startad refreshSidebarCounts från A får inte skriva A:s
 *       kontobundna siffror (sparade jobb, ansökningar, olästa) till state
 *       eller sessionStorage efter att B tagit över. Globala marknadssiffror
 *       är kontooberoende och får fortsatt skrivas.
 * P1-3 (auth-delen): en aktuell händelse ger exakt EN invalidering av
 *       ['jobseeker-dashboard-stats', <aktuell user>] med exact: true.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Cb = (payload: unknown) => void;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

const makeDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const h = vi.hoisted(() => ({
  currentRole: 'job_seeker' as 'job_seeker' | 'employer',
  userId: 'jobseeker-1',
  /** user_id på rollobjektet — kan avvika för att simulera kvarhängande A-roll. */
  roleUserId: null as string | null,
  roleFetched: false,
  channelNames: [] as string[],
  registrations: [] as Array<{
    channel: string;
    table?: string;
    filter?: string;
    cb?: Cb;
  }>,
  /** user_id → deferred count för saved_jobs (simulerar långsamt svar). */
  deferredSaved: new Map<string, Deferred<number>>(),
  savedCounts: {} as Record<string, number>,
  appCounts: {} as Record<string, number>,
  unreadCounts: {} as Record<string, number>,
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
        h.registrations.push({ channel: name, table: opts?.table, filter: opts?.filter, cb });
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const roleRow = () => ({
    id: `role-${h.userId}`,
    user_id: h.roleUserId ?? h.userId,
    role: h.currentRole,
    organization_id: null,
    is_active: true,
  });

  const listQuery = (result: () => { data: unknown; error: null }) => {
    const q = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      in: () => q,
      is: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (onF?: ((v: unknown) => unknown) | null, onR?: ((r: unknown) => unknown) | null) =>
        Promise.resolve(result()).then(onF ?? undefined, onR ?? undefined),
    };
    return q;
  };

  /** Count-query som bokför vilken user_id/applicant_id den frågar för. */
  const countQuery = (resolveFor: (id: string) => Promise<number>) => {
    let target = '';
    const q = {
      select: () => q,
      eq: (_col: string, value: string) => {
        target = value;
        return q;
      },
      is: () => q,
      then: (onF?: ((v: unknown) => unknown) | null, onR?: ((r: unknown) => unknown) | null) =>
        resolveFor(target)
          .then((count) => ({ count, data: null, error: null }))
          .then(onF ?? undefined, onR ?? undefined),
    };
    return q;
  };

  const supabase = {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: {
            session: {
              user: { id: h.userId, email: `${h.userId}@example.com` },
              access_token: 'token',
            },
          },
          error: null,
        }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    rpc: (name: string, args?: Record<string, unknown>) => {
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
      if (name === 'get_job_market_counts') {
        return Promise.resolve({
          data: { total_jobs: 10, unique_companies: 3, new_this_week: 2 },
          error: null,
        });
      }
      if (name === 'get_conversation_summaries') {
        const id = String(args?.p_user_id ?? '');
        return Promise.resolve({
          data: [{ unread_count: h.unreadCounts[id] ?? 0 }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      if (table === 'user_roles') {
        h.roleFetched = true;
        return listQuery(() => ({ data: [roleRow()], error: null }));
      }
      if (table === 'saved_jobs') {
        return countQuery((id) => {
          const deferred = h.deferredSaved.get(id);
          if (deferred) return deferred.promise;
          return Promise.resolve(h.savedCounts[id] ?? 0);
        });
      }
      if (table === 'job_applications') {
        return countQuery((id) => Promise.resolve(h.appCounts[id] ?? 0));
      }
      return listQuery(() => ({ data: [], error: null }));
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
import { isOwnedJobSeekerRole } from '@/lib/roleOwnership';

const SAVED_KEY = 'parium_saved_jobs';
const APPS_KEY = 'parium_my_applications';
const UNREAD_KEY = 'parium_job_seeker_unread_messages';

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderAuth = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <div />
      </AuthProvider>
    </QueryClientProvider>,
  );

const settle = async (ms = 250) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

const jobseekerRegs = (userId: string) =>
  h.registrations.filter(
    (r) =>
      (r.table === 'saved_jobs' && r.filter === `user_id=eq.${userId}`) ||
      (r.table === 'job_applications' && r.filter === `applicant_id=eq.${userId}`),
  );

describe('AuthProvider — generationsbaserad kontoauktoritet', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    h.channelNames.length = 0;
    h.registrations.length = 0;
    h.deferredSaved.clear();
    h.savedCounts = {};
    h.appCounts = {};
    h.unreadCounts = {};
    h.currentRole = 'job_seeker';
    h.userId = 'jobseeker-1';
    h.roleUserId = null;
    h.roleFetched = false;
  });

  afterEach(() => cleanup());

  it('A → utloggning → samma A: A:s uteliggande svar skriver inte den nya sessionen', async () => {
    h.savedCounts['jobseeker-1'] = 99;
    h.appCounts['jobseeker-1'] = 98;
    h.unreadCounts['jobseeker-1'] = 97;
    const deferredFirst = makeDeferred<number>();
    h.deferredSaved.set('jobseeker-1', deferredFirst);

    renderAuth(newClient());
    await waitFor(() => expect(h.channelNames).toContain('auth-saved-jobs-jobseeker-1'), {
      timeout: 5000,
    });
    await settle(100);

    // Logga ut (provider avmonteras) och logga in igen med SAMMA konto.
    cleanup();
    h.channelNames.length = 0;
    h.registrations.length = 0;
    h.deferredSaved.delete('jobseeker-1');
    h.savedCounts['jobseeker-1'] = 4;
    h.appCounts['jobseeker-1'] = 3;
    h.unreadCounts['jobseeker-1'] = 2;

    renderAuth(newClient());
    await waitFor(() => expect(sessionStorage.getItem(SAVED_KEY)).toBe('4'), { timeout: 5000 });

    // Den gamla sessionens svar landar nu — samma user-id, men ogiltig auktoritet.
    await act(async () => {
      deferredFirst.resolve(99);
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(sessionStorage.getItem(SAVED_KEY)).toBe('4');
    expect(sessionStorage.getItem(APPS_KEY)).toBe('3');
    expect(sessionStorage.getItem(UNREAD_KEY)).toBe('2');
  });

  it('avmonterad provider: svaret får inte skriva när en ny provider med samma id monterats', async () => {
    h.savedCounts['jobseeker-1'] = 42;
    const deferredFirst = makeDeferred<number>();
    h.deferredSaved.set('jobseeker-1', deferredFirst);

    renderAuth(newClient());
    await waitFor(() => expect(h.channelNames).toContain('auth-saved-jobs-jobseeker-1'), {
      timeout: 5000,
    });
    await settle(100);
    cleanup();

    h.deferredSaved.delete('jobseeker-1');
    h.savedCounts['jobseeker-1'] = 1;
    renderAuth(newClient());
    await waitFor(() => expect(sessionStorage.getItem(SAVED_KEY)).toBe('1'), { timeout: 5000 });

    await act(async () => {
      deferredFirst.resolve(42);
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(sessionStorage.getItem(SAVED_KEY)).toBe('1');
  });
});
