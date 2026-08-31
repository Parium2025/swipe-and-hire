/**
 * Security regression: AuthProvider must never expose account A's preloaded
 * Home/nav counts or media to account B.
 *
 * sessionStorage holds warm counters (parium_*) that survive an SPA logout.
 * When a different account owns the session, those values must be reset
 * synchronously before B's shell renders — even if B's refresh is delayed or
 * fails entirely.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, cleanup, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  userId: 'user-b' as string | null,
  failQueries: true,
  profileData: null as Record<string, unknown> | null,
  profileError: null as Record<string, unknown> | null,
  profileRpcQueue: [] as Array<Promise<{ data: unknown; error: unknown }>>,
  userRoleRows: null as Record<string, unknown>[] | null,
  organizationData: null as Record<string, unknown> | null,
  signInUserId: null as string | null,
  authCallback: null as null | ((event: string, session: unknown) => void),
  online: false,
  mediaUrlQueue: [] as Array<Promise<string | null>>,
  mediaRequests: [] as string[],
  weatherGuards: [] as Array<(() => boolean) | undefined>,
  signInCalls: 0,
  signInResult: null as Promise<{
    data: { user: Record<string, unknown> | null; session: Record<string, unknown> | null };
    error: { message: string; code?: string } | null;
  }> | null,
  signOutCalls: 0,
  signOutScopes: [] as Array<string | undefined>,
  signOutEmitsSignedOut: false,
  signOutResult: null as Promise<{ error: { message: string } | null }> | null,
  realtimeDisconnectCalls: 0,
  removeAllChannelsCalls: 0,
  getSessionOverride: undefined as undefined | null | {
    user: { id: string; email: string };
    access_token: string;
  },
  removeSessionCalls: 0,
  removeSessionResult: null as Promise<void> | null,
  restoreSessionRegistrationCalls: 0,
  authHardResetCalls: 0,
}));

vi.mock('@/lib/authNavigation', () => ({
  replaceWithCleanAuthPage: () => {
    h.authHardResetCalls += 1;
  },
}));

vi.mock('@/hooks/useSessionManager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useSessionManager')>();
  return {
    ...actual,
    useSessionManager: () => ({
      removeSession: () => {
        h.removeSessionCalls += 1;
        return h.removeSessionResult ?? Promise.resolve();
      },
      restoreSessionRegistration: () => {
        h.restoreSessionRegistrationCalls += 1;
        return Promise.resolve();
      },
    }),
  };
});

vi.mock('@/lib/mediaManager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mediaManager')>();
  return {
    ...actual,
    getMediaUrl: (storagePath: string) => {
      h.mediaRequests.push(storagePath);
      return h.mediaUrlQueue.shift() ?? Promise.resolve(null);
    },
  };
});

vi.mock('@/hooks/useWeather', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useWeather')>();
  return {
    ...actual,
    preloadWeatherLocation: (options?: { isCurrent?: () => boolean }) => {
      h.weatherGuards.push(options?.isCurrent);
      return Promise.resolve(null);
    },
  };
});

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: () => {
    const channel = {
      on: () => channel,
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
  const failing: ListResult = { data: null, error: { message: 'network down' } };
  const makeQuery = (table: string) => {
    const result = (): ListResult => {
      if (table === 'user_roles' && h.userRoleRows) {
        return { data: h.userRoleRows, error: null };
      }
      if (table === 'organizations' && h.organizationData) {
        return { data: h.organizationData, error: null };
      }
      return failing;
    };
    const q = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      in: () => q,
      gte: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: () => Promise.resolve(result()),
      single: () => Promise.resolve(result()),
      then: (
        onF?: ((value: ListResult) => unknown) | null,
        onR?: ((reason: unknown) => unknown) | null
      ) => Promise.resolve(result()).then(onF ?? undefined, onR ?? undefined),
    };
    return q;
  };

  const supabase = {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: {
            session: h.getSessionOverride !== undefined
              ? h.getSessionOverride
              : h.userId
              ? {
                  user: { id: h.userId, email: 'b@example.com' },
                  access_token: 'token-b',
                }
              : null,
          },
          error: null,
        }),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        h.authCallback = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithPassword: ({ email }: { email: string }) => {
        h.signInCalls += 1;
        if (h.signInResult) return h.signInResult;
        const user = {
          id: h.signInUserId ?? h.userId ?? 'signed-in-user',
          email,
          email_confirmed_at: '2026-08-30T00:00:00.000Z',
          user_metadata: {},
        };
        const session = { user, access_token: 'signed-in-token' };
        h.authCallback?.('SIGNED_IN', session);
        return Promise.resolve({ data: { user, session }, error: null });
      },
      signOut: (options?: { scope?: string }) => {
        h.signOutCalls += 1;
        h.signOutScopes.push(options?.scope);
        const result = h.signOutResult ?? Promise.resolve({ error: null });
        if (!h.signOutEmitsSignedOut) return result;
        return result.then((value) => {
          if (!value.error) {
            h.userId = null;
            h.authCallback?.('SIGNED_OUT', null);
          }
          return value;
        });
      },
      verifyOtp: () => {
        const user = { id: 'user-b', email: 'b@example.com' };
        const session = { user, access_token: 'otp-token' };
        h.authCallback?.('SIGNED_IN', session);
        return Promise.resolve({ data: { user, session }, error: null });
      },
      refreshSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
    rpc: (name: string) => {
      if (name !== 'get_my_profile') {
        return Promise.resolve({ data: null, error: h.profileError ?? failing.error });
      }
      const queued = h.profileRpcQueue.shift();
      if (queued) return queued;
      return h.profileData
        ? Promise.resolve({ data: [h.profileData], error: null })
        : Promise.resolve({ data: null, error: h.profileError ?? failing.error });
    },
    from: (table: string) => makeQuery(table),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
    realtime: {
      disconnect: () => {
        h.realtimeDisconnectCalls += 1;
      },
    },
    removeAllChannels: () => {
      h.removeAllChannelsCalls += 1;
      return Promise.resolve([]);
    },
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
  };

  return { supabase };
});

vi.mock('@/lib/connectivityManager', () => ({
  forceConnectivityCheck: vi.fn(async () => h.online),
  getIsOnline: vi.fn(() => h.online),
  onConnectivityChange: vi.fn(() => () => {}),
}));

import { AuthProvider, useAuth } from '@/hooks/useAuth';

let renderedAccountSnapshots: string[] = [];
let latestSignOut: (() => Promise<void>) | null = null;
let latestSignIn: ((email: string, password: string) => Promise<{ error?: unknown }>) | null = null;
let latestVerifyOtp: ((phone: string, otp: string) => Promise<{ error?: unknown }>) | null = null;
let latestRefreshProfile: (() => Promise<void>) | null = null;
let latestRunAuthLinkSessionTransition: ReturnType<typeof useAuth>['runAuthLinkSessionTransition'] | null = null;

const Probe = () => {
  const {
    preloadedSavedJobs,
    preloadedMyApplications,
    preloadedAvatarUrl,
    preloadedVideoUrl,
    profile,
    user,
    loading,
    signOut,
    signIn,
    verifyOtp,
    userRole,
    organization,
    refreshProfile,
    runAuthLinkSessionTransition,
  } = useAuth();
  latestSignOut = signOut;
  latestSignIn = signIn;
  latestVerifyOtp = verifyOtp;
  latestRefreshProfile = refreshProfile;
  latestRunAuthLinkSessionTransition = runAuthLinkSessionTransition;
  renderedAccountSnapshots.push(`${user?.id ?? 'none'}:${profile?.user_id ?? 'none'}`);
  return (
    <div>
      <span data-testid="saved">{preloadedSavedJobs}</span>
      <span data-testid="applications">{preloadedMyApplications}</span>
      <span data-testid="avatar">{preloadedAvatarUrl ?? 'none'}</span>
      <span data-testid="video">{preloadedVideoUrl ?? 'none'}</span>
      <span data-testid="profile">{profile?.first_name ?? 'none'}</span>
      <span data-testid="user">{user?.id ?? 'none'}</span>
      <span data-testid="profile-owner">{profile?.user_id ?? 'none'}</span>
      <span data-testid="membership-role">{userRole?.role ?? 'none'}</span>
      <span data-testid="organization">{organization?.name ?? 'none'}</span>
      <span data-testid="role">{profile?.role ?? 'none'}</span>
      <span data-testid="onboarding">{String(profile?.onboarding_completed ?? 'none')}</span>
      <span data-testid="location">{profile?.location ?? 'none'}</span>
      <span data-testid="home-location">{profile?.home_location ?? 'none'}</span>
      <span data-testid="address">{profile?.address ?? 'none'}</span>
      <span data-testid="background-location">
        {String(profile?.background_location_enabled ?? 'none')}
      </span>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
    </div>
  );
};

const renderProvider = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('AuthProvider account transition cache isolation', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      writable: true,
      value: (callback: () => void) => {
        callback();
        return 1;
      },
    });
    localStorage.clear();
    sessionStorage.clear();
    h.userId = 'user-b';
    h.failQueries = true;
    h.profileData = null;
    h.profileError = null;
    h.profileRpcQueue = [];
    h.userRoleRows = null;
    h.organizationData = null;
    h.signInUserId = null;
    h.authCallback = null;
    h.online = false;
    h.mediaUrlQueue = [];
    h.mediaRequests = [];
    h.weatherGuards = [];
    h.signInCalls = 0;
    h.signInResult = null;
    h.signOutCalls = 0;
    h.signOutScopes = [];
    h.signOutEmitsSignedOut = false;
    h.signOutResult = null;
    h.realtimeDisconnectCalls = 0;
    h.removeAllChannelsCalls = 0;
    h.getSessionOverride = undefined;
    h.removeSessionCalls = 0;
    h.removeSessionResult = null;
    h.restoreSessionRegistrationCalls = 0;
    h.authHardResetCalls = 0;
    renderedAccountSnapshots = [];
    latestSignOut = null;
    latestSignIn = null;
    latestVerifyOtp = null;
    latestRefreshProfile = null;
    latestRunAuthLinkSessionTransition = null;
    // Account A left warm caches behind in this tab.
    sessionStorage.setItem('parium_cache_owner', 'user-a');
    sessionStorage.setItem('parium_saved_jobs', '7');
    sessionStorage.setItem('parium_my_applications', '4');
    sessionStorage.setItem('parium_avatar_url', 'https://signed/a-avatar.png');
    localStorage.setItem('job_seeker_interviews_user-a', JSON.stringify({ interviews: [] }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'requestIdleCallback');
  });

  it('never renders account A values for account B, even when B refresh fails', async () => {
    renderProvider();

    await waitFor(() => {
      expect(sessionStorage.getItem('parium_cache_owner')).toBe('user-b');
    });

    expect(screen.getByTestId('saved').textContent).toBe('0');
    expect(screen.getByTestId('applications').textContent).toBe('0');
    expect(screen.getByTestId('avatar').textContent).toBe('none');
    expect(localStorage.getItem('job_seeker_interviews_user-a')).toBeNull();
  });

  it('keeps warm caches for the same account owner', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    sessionStorage.setItem('parium_saved_jobs', '9');

    renderProvider();

    await waitFor(() => {
      expect(sessionStorage.getItem('parium_cache_owner')).toBe('user-b');
    });

    expect(sessionStorage.getItem('parium_saved_jobs')).toBe('9');
  });

  it('keeps the same user cached profile when the initial profile RPC fails offline', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Cached Bea',
      role: 'job_seeker',
      onboarding_completed: true,
      location: 'Stockholm',
      home_location: 'Uppsala',
      address: 'Testvägen 1',
      background_location_enabled: true,
    }));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('profile').textContent).toBe('Cached Bea');
    expect(screen.getByTestId('role').textContent).toBe('job_seeker');
    expect(screen.getByTestId('onboarding').textContent).toBe('true');
    expect(screen.getByTestId('location').textContent).toBe('Stockholm');
    expect(screen.getByTestId('home-location').textContent).toBe('Uppsala');
    expect(screen.getByTestId('address').textContent).toBe('Testvägen 1');
    expect(screen.getByTestId('background-location').textContent).toBe('true');
    expect(JSON.parse(localStorage.getItem('parium_cached_profile')!).user_id).toBe('user-b');
  });

  it('persists the route-critical profile fields needed for a later offline Home start', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    h.profileData = {
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Bea',
      last_name: 'Berg',
      role: 'job_seeker',
      onboarding_completed: true,
      location: 'Göteborg',
      home_location: 'Göteborg',
      address: 'Avenyn 1',
      background_location_enabled: false,
    };

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    const cached = JSON.parse(localStorage.getItem('parium_cached_profile')!);
    expect(cached).toMatchObject({
      user_id: 'user-b',
      role: 'job_seeker',
      onboarding_completed: true,
      location: 'Göteborg',
      home_location: 'Göteborg',
      address: 'Avenyn 1',
      background_location_enabled: false,
    });
  });

  it('rejects a same-user cached profile with a non-routable role', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Invalid Bea',
      role: 'admin',
      onboarding_completed: true,
    }));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('profile').textContent).toBe('none');
    expect(localStorage.getItem('parium_cached_profile')).toBeNull();
  });

  it('accepts employer as the other valid cached route role', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Employer Bea',
      role: 'employer',
      onboarding_completed: true,
    }));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('profile').textContent).toBe('Employer Bea');
    expect(screen.getByTestId('role').textContent).toBe('employer');
  });

  it('does not authorize cached routing after an authoritative profile denial', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Stale Bea',
      role: 'job_seeker',
      onboarding_completed: true,
    }));
    h.online = true;
    h.profileError = { message: 'permission denied', code: '42501', status: 403 };

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    expect(screen.getByTestId('profile').textContent).toBe('none');
    expect(screen.getByTestId('role').textContent).toBe('none');
    expect(localStorage.getItem('parium_cached_profile')).toBeNull();
  });

  it('binds only the incoming account cached profile before exposing its user', async () => {
    h.userId = null;
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-a',
      user_id: 'user-a',
      first_name: 'Cached Alice',
      role: 'job_seeker',
    }));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(screen.getByTestId('profile').textContent).toBe('none');

    sessionStorage.setItem('parium_cache_owner', 'user-b');
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Cached Bea',
      role: 'job_seeker',
      onboarding_completed: true,
    }));

    await act(async () => {
      h.authCallback?.('SIGNED_IN', {
        user: { id: 'user-b', email: 'b@example.com' },
        access_token: 'token-b',
      });
      await new Promise((resolve) => setTimeout(resolve, 75));
    });

    expect(screen.getByTestId('user').textContent).toBe('user-b');
    expect(screen.getByTestId('profile-owner').textContent).toBe('user-b');
    expect(screen.getByTestId('profile').textContent).toBe('Cached Bea');
    expect(renderedAccountSnapshots.find((snapshot) => snapshot.startsWith('user-b:')))
      .toBe('user-b:user-b');
  });

  it('never exposes account A role or organization during a direct A to B sign-in with a transient B profile failure', async () => {
    h.userId = 'user-a';
    h.profileData = {
      id: 'profile-user-a',
      user_id: 'user-a',
      first_name: 'Alice',
      role: 'employer',
      organization_id: 'org-a',
    };
    h.userRoleRows = [{
      id: 'role-a',
      user_id: 'user-a',
      role: 'employer',
      organization_id: 'org-a',
      is_active: true,
    }];
    h.organizationData = {
      id: 'org-a',
      name: 'Account A AB',
      subscription_plan: 'business',
      max_recruiters: 10,
    };
    h.online = true;
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('membership-role').textContent).toBe('employer');
      expect(screen.getByTestId('organization').textContent).toBe('Account A AB');
    });

    h.signInUserId = 'user-b';
    h.profileData = null;
    h.profileError = { message: 'network down' };
    h.userRoleRows = null;
    h.organizationData = null;
    h.online = false;

    await act(async () => { await latestSignIn!('b@example.com', 'password'); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    expect(screen.getByTestId('membership-role').textContent).toBe('none');
    expect(screen.getByTestId('organization').textContent).toBe('none');
  });

  it('accepts an explicit same-tab auth-link transition from account A to account B', async () => {
    h.userId = 'user-a';
    h.profileData = {
      id: 'profile-user-a',
      user_id: 'user-a',
      first_name: 'Alice',
      role: 'job_seeker',
    };
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-a'));

    h.profileData = null;
    h.profileError = { message: 'network down' };
    const userB = { id: 'user-b', email: 'b@example.com' };
    const sessionB = { user: userB, access_token: 'auth-link-token-b' };
    await act(async () => {
      await latestRunAuthLinkSessionTransition!(async () => {
        h.authCallback?.('SIGNED_IN', sessionB);
        return { data: { session: sessionB as never }, error: null };
      });
      await Promise.resolve();
    });

    expect(screen.getByTestId('user').textContent).toBe('user-b');
    expect(screen.getByTestId('profile-owner').textContent).toBe('none');
  });

  it('rejects a held account-C event when the explicit auth-link result is account B', async () => {
    h.userId = null;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    const sessionC = {
      user: { id: 'user-c', email: 'c@example.com' },
      access_token: 'event-token-c',
    };
    const sessionB = {
      user: { id: 'user-b', email: 'b@example.com' },
      access_token: 'result-token-b',
    };
    sessionStorage.setItem('sb-example-auth-token', JSON.stringify(sessionC));

    await expect(latestRunAuthLinkSessionTransition!(async () => {
      h.authCallback?.('SIGNED_IN', sessionC);
      return { data: { session: sessionB as never }, error: null };
    })).rejects.toThrow(/matchade inte/i);

    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(sessionStorage.getItem('sb-example-auth-token')).toBeNull();
  });

  it('rejects a same-user auth event when its token differs from the explicit result', async () => {
    h.userId = 'user-a';
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-a'));

    const eventSession = {
      user: { id: 'user-a', email: 'a@example.com' },
      access_token: 'event-token-a',
    };
    const resultSession = { ...eventSession, access_token: 'result-token-a' };
    sessionStorage.setItem('sb-example-auth-token', JSON.stringify(eventSession));

    await expect(latestRunAuthLinkSessionTransition!(async () => {
      h.authCallback?.('SIGNED_IN', eventSession);
      return { data: { session: resultSession as never }, error: null };
    })).rejects.toThrow(/matchade inte/i);

    expect(screen.getByTestId('user').textContent).toBe('user-a');
    expect(sessionStorage.getItem('sb-example-auth-token')).toBeNull();
  });

  it('drops a held SIGNED_IN credential when the explicit operation returns an error', async () => {
    h.userId = null;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    const eventSession = {
      user: { id: 'user-b', email: 'b@example.com' },
      access_token: 'unverified-token-b',
    };
    sessionStorage.setItem('sb-example-auth-token', JSON.stringify(eventSession));

    const result = await latestRunAuthLinkSessionTransition!(async () => {
      h.authCallback?.('SIGNED_IN', eventSession);
      return {
        data: { session: null },
        error: { message: 'verification failed' },
      };
    });

    expect(result.error).toEqual({ message: 'verification failed' });
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(sessionStorage.getItem('sb-example-auth-token')).toBeNull();
  });

  it('clears a persisted auth credential when no matching auth event arrives before timeout', async () => {
    h.userId = null;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));
    vi.useFakeTimers();

    const resultSession = {
      user: { id: 'user-b', email: 'b@example.com' },
      access_token: 'persisted-without-event',
    };
    sessionStorage.setItem('sb-example-auth-token', JSON.stringify(resultSession));
    const transition = latestRunAuthLinkSessionTransition!(async () => ({
      data: { session: resultSession as never },
      error: null,
    }));
    const settled = transition.then(
      () => null,
      (error: unknown) => error,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await settled).toBeInstanceOf(Error);
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(sessionStorage.getItem('sb-example-auth-token')).toBeNull();
    expect(h.authHardResetCalls).toBe(1);
  });

  it('does not start an auth-link operation while password authority is unresolved', async () => {
    h.userId = null;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    let resolvePassword!: (result: {
      data: { user: null; session: null };
      error: { message: string };
    }) => void;
    h.signInResult = new Promise((resolve) => { resolvePassword = resolve; });
    let passwordAttempt!: Promise<{ error?: unknown }>;
    act(() => {
      passwordAttempt = latestSignIn!('b@example.com', 'password');
    });
    await act(async () => { await Promise.resolve(); });

    const authLinkOperation = vi.fn(async () => ({
      data: { session: null },
      error: { message: 'not started' },
    }));
    await expect(latestRunAuthLinkSessionTransition!(authLinkOperation))
      .rejects.toThrow(/pågår redan/i);
    expect(authLinkOperation).not.toHaveBeenCalled();

    await act(async () => {
      resolvePassword({
        data: { user: null, session: null },
        error: { message: 'cancelled for test' },
      });
      await passwordAttempt;
    });
  });

  it('quarantines a late SDK session event after the explicit auth-link operation timed out', async () => {
    h.userId = null;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));
    vi.useFakeTimers();

    const lateSession = {
      user: { id: 'user-b', email: 'b@example.com' },
      access_token: 'token-b',
    };
    let resolveOperation!: (value: {
      data: { session: never };
      error: null;
    }) => void;
    const operation = new Promise<{
      data: { session: never };
      error: null;
    }>((resolve) => { resolveOperation = resolve; });
    const transition = latestRunAuthLinkSessionTransition!(() => operation);
    const settled = transition.then(
      () => null,
      (error: unknown) => error,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(await settled).toBeInstanceOf(Error);
    await expect(latestRunAuthLinkSessionTransition!(async () => ({
      data: { session: lateSession as never },
      error: null,
    }))).rejects.toThrow(/pågår redan/i);

    await act(async () => {
      resolveOperation({ data: { session: lateSession as never }, error: null });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      sessionStorage.setItem('sb-example-auth-token', JSON.stringify(lateSession));
      h.userId = 'user-b';
      h.authCallback?.('SIGNED_IN', lateSession);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(sessionStorage.getItem('sb-example-auth-token')).toBeNull();
    expect(h.signOutCalls).toBeGreaterThanOrEqual(1);
  });

  it('blocks password login while an abandoned auth-link ticket is still unresolved', async () => {
    h.userId = null;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));
    vi.useFakeTimers();

    const unresolvedOperation = new Promise<{
      data: { session: never };
      error: null;
    }>(() => {});
    const transition = latestRunAuthLinkSessionTransition!(() => unresolvedOperation);
    const settled = transition.catch((error: unknown) => error);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(await settled).toBeInstanceOf(Error);

    const passwordResult = await latestSignIn!('b@example.com', 'password');

    expect(h.signInCalls).toBe(0);
    expect(passwordResult).toMatchObject({
      error: { code: 'auth_in_progress' },
    });
  });

  it('emits a local SIGNED_OUT reset when rejected credentials leave no readable session', async () => {
    h.userId = 'user-a';
    sessionStorage.setItem('parium_cache_owner', 'user-a');
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-a'));
    vi.useFakeTimers();

    h.getSessionOverride = null;
    h.signOutEmitsSignedOut = true;
    const rejectedSession = {
      user: { id: 'user-b', email: 'b@example.com' },
      access_token: 'rejected-token-b',
    };

    const result = await latestRunAuthLinkSessionTransition!(async () => {
      h.authCallback?.('SIGNED_IN', rejectedSession);
      return {
        data: { session: null },
        error: { message: 'verification failed' },
      };
    });
    expect(result.error).toEqual({ message: 'verification failed' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(h.signOutScopes).toContain('local');
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('ignores a late account A role or organization refresh after switching to B', async () => {
    h.userId = 'user-a';
    h.profileData = {
      id: 'profile-user-a',
      user_id: 'user-a',
      first_name: 'Alice',
      role: 'employer',
      organization_id: 'org-a',
    };
    h.userRoleRows = [{
      id: 'role-a',
      user_id: 'user-a',
      role: 'employer',
      organization_id: 'org-a',
      is_active: true,
    }];
    h.organizationData = {
      id: 'org-a',
      name: 'Account A AB',
      subscription_plan: 'business',
      max_recruiters: 10,
    };
    h.online = true;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('organization').textContent).toBe('Account A AB'));

    let resolveStaleA!: (value: { data: unknown; error: unknown }) => void;
    const staleAProfile = new Promise<{ data: unknown; error: unknown }>((resolve) => {
      resolveStaleA = resolve;
    });
    h.profileRpcQueue = [
      staleAProfile,
      Promise.resolve({ data: null, error: { message: 'network down' } }),
    ];
    const staleRefresh = latestRefreshProfile!();

    h.signInUserId = 'user-b';
    h.profileData = null;
    h.profileError = { message: 'network down' };
    h.userRoleRows = null;
    h.organizationData = null;
    h.online = false;
    await act(async () => { await latestSignIn!('b@example.com', 'password'); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    resolveStaleA({
      data: [{
        id: 'profile-user-a-late',
        user_id: 'user-a',
        role: 'employer',
        organization_id: 'org-a',
      }],
      error: null,
    });
    await act(async () => { await staleRefresh; });

    expect(screen.getByTestId('membership-role').textContent).toBe('none');
    expect(screen.getByTestId('organization').textContent).toBe('none');
  });

  it('never lets account A late media preloads repopulate account B state or session cache', async () => {
    h.userId = 'user-a';
    h.profileData = {
      id: 'profile-user-a',
      user_id: 'user-a',
      first_name: 'Alice',
      role: 'job_seeker',
      profile_image_url: 'user-a/avatar.jpg',
    };
    let resolveAvatar!: (url: string | null) => void;
    h.mediaUrlQueue = [new Promise<string | null>((resolve) => { resolveAvatar = resolve; })];

    renderProvider();
    await waitFor(() => expect(h.mediaRequests).toContain('user-a/avatar.jpg'));

    let resolveBProfile!: (value: { data: unknown; error: unknown }) => void;
    h.profileRpcQueue = [new Promise((resolve) => { resolveBProfile = resolve; })];
    h.signInUserId = 'user-b';
    await act(async () => { await latestSignIn!('b@example.com', 'password'); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    await act(async () => {
      resolveAvatar('https://signed.example/user-a-avatar.jpg');
      // Without an owner guard the old flow first waits up to 500 ms for DOM
      // preloading and only then writes the stale signed URL.
      await new Promise((resolve) => setTimeout(resolve, 650));
    });

    expect(screen.getByTestId('avatar').textContent).toBe('none');
    expect(sessionStorage.getItem('parium_avatar_url')).toBeNull();

    // Let the current account request settle so the provider has no dangling work.
    resolveBProfile({ data: null, error: { message: 'network down' } });
  });

  it('discards a late account A background-video URL after switching to B', async () => {
    h.userId = 'user-a';
    h.profileData = {
      id: 'profile-user-a',
      user_id: 'user-a',
      first_name: 'Alice',
      role: 'job_seeker',
      video_url: 'user-a/profile.mp4',
    };
    let resolveVideo!: (url: string | null) => void;
    h.mediaUrlQueue = [new Promise<string | null>((resolve) => { resolveVideo = resolve; })];

    renderProvider();
    await waitFor(() => expect(h.mediaRequests).toContain('user-a/profile.mp4'));

    h.profileRpcQueue = [new Promise(() => {})];
    h.signInUserId = 'user-b';
    await act(async () => { await latestSignIn!('b@example.com', 'password'); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    await act(async () => {
      resolveVideo('https://signed.example/user-a-video.mp4');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('video').textContent).toBe('none');
    expect(sessionStorage.getItem('parium_video_url')).toBeNull();
  });

  it('passes an account-generation guard into the weather preload', async () => {
    h.userId = 'user-a';
    h.profileData = {
      id: 'profile-user-a',
      user_id: 'user-a',
      first_name: 'Alice',
      role: 'job_seeker',
    };

    renderProvider();
    await waitFor(() => expect(h.weatherGuards).toHaveLength(1));
    const accountAGuard = h.weatherGuards[0];
    expect(accountAGuard?.()).toBe(true);

    h.profileData = null;
    h.profileError = { message: 'network down' };
    h.signInUserId = 'user-b';
    await act(async () => { await latestSignIn!('b@example.com', 'password'); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    expect(accountAGuard?.()).toBe(false);
  });

  it('waits for registered note flushes before clearing the signed-in account', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Cached Bea',
      role: 'job_seeker',
      onboarding_completed: true,
    }));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    let releaseFlush!: () => void;
    const pendingFlush = new Promise<void>((resolve) => { releaseFlush = resolve; });
    const onFlush = (event: Event) => {
      const detail = (event as CustomEvent<{
        waitUntil: (flush: Promise<unknown>) => void;
      }>).detail;
      detail.waitUntil(pendingFlush);
    };
    window.addEventListener('parium:flush-pending-notes-before-sign-out', onFlush);

    let signOutPromise!: Promise<void>;
    act(() => {
      signOutPromise = latestSignOut!();
    });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId('user').textContent).toBe('user-b');
    expect(localStorage.getItem('parium_cached_profile')).not.toBeNull();

    await act(async () => {
      releaseFlush();
      await signOutPromise;
    });
    window.removeEventListener('parium:flush-pending-notes-before-sign-out', onFlush);

    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(localStorage.getItem('parium_cached_profile')).toBeNull();
  });

  it('never starts a second password request while the first request is pending', async () => {
    h.userId = null;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    const user = {
      id: 'user-b',
      email: 'b@example.com',
      email_confirmed_at: '2026-08-30T00:00:00.000Z',
      user_metadata: {},
    };
    const session = { user, access_token: 'signed-in-token' };
    let resolveSignIn!: (result: {
      data: { user: Record<string, unknown>; session: Record<string, unknown> };
      error: null;
    }) => void;
    h.signInResult = new Promise((resolve) => { resolveSignIn = resolve; });

    let first!: Promise<{ error?: unknown }>;
    let second!: Promise<{ error?: unknown }>;
    act(() => {
      first = latestSignIn!('b@example.com', 'password');
      second = latestSignIn!('b@example.com', 'password');
    });
    await act(async () => { await Promise.resolve(); });

    expect(h.signInCalls).toBe(1);
    await expect(second).resolves.toEqual({
      error: {
        code: 'auth_in_progress',
        message: expect.stringMatching(/inloggning pågår/i),
      },
    });

    await act(async () => {
      h.authCallback?.('SIGNED_IN', session);
      resolveSignIn({ data: { user, session }, error: null });
      await Promise.all([first, second]);
    });
  });

  it('only accepts a SIGNED_IN event whose normalized email matches the active password attempt', async () => {
    h.userId = 'user-a';
    sessionStorage.setItem('parium_cache_owner', 'user-a');
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-a'));

    const expectedUser = {
      id: 'user-b',
      email: 'b@example.com',
      email_confirmed_at: '2026-08-30T00:00:00.000Z',
      user_metadata: {},
    };
    const expectedSession = { user: expectedUser, access_token: 'signed-in-token-b' };
    let resolveSignIn!: (result: {
      data: { user: Record<string, unknown>; session: Record<string, unknown> };
      error: null;
    }) => void;
    h.signInResult = new Promise((resolve) => { resolveSignIn = resolve; });

    let signInPromise!: Promise<{ error?: unknown }>;
    act(() => {
      signInPromise = latestSignIn!('  B@Example.COM  ', 'password');
    });
    await act(async () => { await Promise.resolve(); });

    const foreignUser = {
      id: 'user-c',
      email: 'c@example.com',
      email_confirmed_at: '2026-08-30T00:00:00.000Z',
      user_metadata: {},
    };
    h.getSessionOverride = null;
    await act(async () => {
      h.authCallback?.('SIGNED_IN', { user: foreignUser, access_token: 'foreign-token' });
      await Promise.resolve();
    });
    await waitFor(() => expect(h.signOutCalls).toBe(1));
    expect(h.signOutScopes).toContain('local');
    expect(screen.getByTestId('user').textContent).toBe('user-a');

    await act(async () => {
      h.authCallback?.('SIGNED_IN', expectedSession);
      resolveSignIn({ data: { user: expectedUser, session: expectedSession }, error: null });
      await signInPromise;
    });
    expect(screen.getByTestId('user').textContent).toBe('user-b');
  });

  it('keeps the password attempt authoritative when the request settles before its matching auth event', async () => {
    h.userId = 'user-a';
    sessionStorage.setItem('parium_cache_owner', 'user-a');
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-a'));

    const user = {
      id: 'user-b',
      email: 'b@example.com',
      email_confirmed_at: '2026-08-30T00:00:00.000Z',
      user_metadata: {},
    };
    const session = { user, access_token: 'signed-in-token-b' };
    h.signInResult = Promise.resolve({ data: { user, session }, error: null });

    let firstSignIn!: Promise<{ error?: unknown }>;
    act(() => {
      firstSignIn = latestSignIn!('B@EXAMPLE.COM', 'password');
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const overlapping = await latestSignIn!('other@example.com', 'password');
    expect(overlapping).toEqual({
      error: {
        code: 'auth_in_progress',
        message: expect.stringMatching(/inloggning pågår/i),
      },
    });
    expect(h.signInCalls).toBe(1);

    await act(async () => {
      h.authCallback?.('SIGNED_IN', session);
      await firstSignIn;
    });
    expect(screen.getByTestId('user').textContent).toBe('user-b');
  });

  it('starts a fresh inactivity clock only after an explicit password sign-in succeeds', async () => {
    h.userId = null;
    const previousActivity = Date.now() - 60 * 60 * 1000;
    localStorage.setItem('parium-last-activity', String(previousActivity));
    sessionStorage.setItem('parium-last-activity', String(previousActivity));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    await act(async () => {
      await latestSignIn!('b@example.com', 'password');
    });

    expect(Number(localStorage.getItem('parium-last-activity'))).toBeGreaterThan(previousActivity);
    expect(Number(sessionStorage.getItem('parium-last-activity'))).toBeGreaterThan(previousActivity);
  });

  it('starts a fresh inactivity clock only after an explicit phone OTP succeeds', async () => {
    h.userId = null;
    const previousActivity = Date.now() - 60 * 60 * 1000;
    localStorage.setItem('parium-last-activity', String(previousActivity));
    sessionStorage.setItem('parium-last-activity', String(previousActivity));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    await act(async () => {
      await latestVerifyOtp!('+46700000000', '123456');
    });

    expect(Number(localStorage.getItem('parium-last-activity'))).toBeGreaterThan(previousActivity);
    expect(Number(sessionStorage.getItem('parium-last-activity'))).toBeGreaterThan(previousActivity);
  });

  it('authorizes phone OTP as an explicit same-tab account transition', async () => {
    h.userId = 'user-a';
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-a'));

    await act(async () => {
      await latestVerifyOtp!('+46700000000', '123456');
    });

    expect(screen.getByTestId('user').textContent).toBe('user-b');
  });

  it('does not retry a timed-out password request while the original request is still alive', async () => {
    h.userId = null;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    let resolveSignIn!: (result: {
      data: { user: null; session: null };
      error: { message: string };
    }) => void;
    h.signInResult = new Promise((resolve) => { resolveSignIn = resolve; });

    vi.useFakeTimers();
    let signInPromise!: Promise<{ error?: unknown }>;
    act(() => {
      signInPromise = latestSignIn!('b@example.com', 'password');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_600);
    });

    expect(h.signInCalls).toBe(1);

    await act(async () => {
      resolveSignIn({ data: { user: null, session: null }, error: { message: 'late network failure' } });
      await signInPromise;
    });
    vi.useRealTimers();
  });

  it('does not release a timed-out attempt until its late auth event and request have both settled', async () => {
    h.userId = null;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    const user = {
      id: 'user-b',
      email: 'b@example.com',
      email_confirmed_at: '2026-08-30T00:00:00.000Z',
      user_metadata: {},
    };
    const session = { user, access_token: 'late-signed-in-token' };
    let resolveSignIn!: (result: {
      data: { user: Record<string, unknown>; session: Record<string, unknown> };
      error: null;
    }) => void;
    h.signInResult = new Promise((resolve) => { resolveSignIn = resolve; });

    vi.useFakeTimers();
    let firstSignIn!: Promise<{ error?: unknown }>;
    act(() => {
      firstSignIn = latestSignIn!('b@example.com', 'password');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_600);
      await firstSignIn;
    });

    await act(async () => {
      h.authCallback?.('SIGNED_IN', session);
      await Promise.resolve();
    });
    let overlapping!: Promise<{ error?: unknown }>;
    await act(async () => {
      overlapping = latestSignIn!('b@example.com', 'password');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(h.signInCalls).toBe(1);
    await expect(overlapping).resolves.toMatchObject({
      error: { code: 'auth_in_progress' },
    });

    await act(async () => {
      resolveSignIn({ data: { user, session }, error: null });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('abandons and locally removes a password session that succeeds after the UI timeout', async () => {
    h.userId = null;
    const previousActivity = Date.now() - 60 * 60 * 1000;
    localStorage.setItem('parium-last-activity', String(previousActivity));
    sessionStorage.setItem('parium-last-activity', String(previousActivity));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    const user = {
      id: 'user-b',
      email: 'b@example.com',
      email_confirmed_at: '2026-08-30T00:00:00.000Z',
      user_metadata: {},
    };
    const session = { user, access_token: 'late-signed-in-token' };
    let resolveSignIn!: (result: {
      data: { user: Record<string, unknown>; session: Record<string, unknown> };
      error: null;
    }) => void;
    h.signInResult = new Promise((resolve) => { resolveSignIn = resolve; });

    vi.useFakeTimers();
    let signInPromise!: Promise<{ error?: unknown }>;
    act(() => {
      signInPromise = latestSignIn!('b@example.com', 'password');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_600);
      await signInPromise;
    });

    expect(Number(localStorage.getItem('parium-last-activity'))).toBe(previousActivity);
    sessionStorage.setItem('sb-example-auth-token', JSON.stringify({
      access_token: 'late-signed-in-token',
      user,
    }));
    localStorage.setItem('parium-auth-snapshot:sb-example-auth-token', JSON.stringify({
      access_token: 'late-signed-in-token',
      user,
    }));
    localStorage.setItem('parium-auth-snapshot-owner', user.id);
    h.getSessionOverride = null;

    await act(async () => {
      resolveSignIn({ data: { user, session }, error: null });
      await Promise.resolve();
      await Promise.resolve();
    });

    // A reload/suspended tab can happen before the next timer task. The
    // rejected credential and Remember-me snapshot must already be gone.
    expect(sessionStorage.getItem('sb-example-auth-token')).toBeNull();
    expect(localStorage.getItem('parium-auth-snapshot:sb-example-auth-token')).toBeNull();
    expect(localStorage.getItem('parium-auth-snapshot-owner')).toBeNull();

    await act(async () => {
      h.authCallback?.('SIGNED_IN', session);
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(h.signOutCalls).toBe(1);
    expect(h.signOutScopes).toContain('local');
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(localStorage.getItem('parium-last-activity')).toBe(String(previousActivity));
    expect(sessionStorage.getItem('parium-last-activity')).toBe(String(previousActivity));
    expect(sessionStorage.getItem('sb-example-auth-token')).toBeNull();
  });

  it('keeps the signed-in UI and account caches until Supabase credentials are cleared', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Cached Bea',
      role: 'job_seeker',
      onboarding_completed: true,
    }));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    let resolveSignOut!: (result: { error: null }) => void;
    h.signOutResult = new Promise((resolve) => { resolveSignOut = resolve; });

    let signOutPromise!: Promise<void>;
    act(() => {
      signOutPromise = latestSignOut!();
    });
    await act(async () => { await Promise.resolve(); });

    expect(h.signOutCalls).toBe(1);
    expect(screen.getByTestId('user').textContent).toBe('user-b');
    expect(localStorage.getItem('parium_cached_profile')).not.toBeNull();

    await act(async () => {
      resolveSignOut({ error: null });
      await signOutPromise;
    });

    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(localStorage.getItem('parium_cached_profile')).toBeNull();
  });

  it('leaves logout recoverable when Supabase refuses to clear credentials', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Cached Bea',
      role: 'job_seeker',
      onboarding_completed: true,
    }));
    h.signOutResult = Promise.resolve({ error: { message: 'network unavailable' } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    await act(async () => { await latestSignOut!(); });

    expect(screen.getByTestId('user').textContent).toBe('user-b');
    expect(localStorage.getItem('parium_cached_profile')).not.toBeNull();
    expect(h.restoreSessionRegistrationCalls).toBe(1);

    h.signOutResult = Promise.resolve({ error: null });
    await act(async () => { await latestSignOut!(); });

    expect(h.signOutCalls).toBe(2);
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('re-registers the device session only after a timed-out cleanup eventually settles', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    let resolveRemoveSession!: () => void;
    h.removeSessionResult = new Promise<void>((resolve) => { resolveRemoveSession = resolve; });
    h.signOutResult = Promise.resolve({ error: { message: 'network unavailable' } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    vi.useFakeTimers();
    let signOutPromise!: Promise<void>;
    act(() => {
      signOutPromise = latestSignOut!();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
      await signOutPromise;
    });

    expect(h.signOutCalls).toBe(1);
    expect(h.restoreSessionRegistrationCalls).toBe(0);

    await act(async () => {
      resolveRemoveSession();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(h.restoreSessionRegistrationCalls).toBe(1);
  });

  it('finishes a hanging credential logout once with a local fail-safe', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    sessionStorage.setItem('sb-example-auth-token', JSON.stringify({
      access_token: 'token-b',
      user: { id: 'user-b', email: 'b@example.com' },
    }));
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Cached Bea',
      role: 'job_seeker',
      onboarding_completed: true,
    }));
    h.signOutResult = new Promise(() => {});
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    vi.useFakeTimers();
    let settled = false;
    let firstSignOut!: Promise<void>;
    act(() => {
      firstSignOut = latestSignOut!();
      void latestSignOut!();
      void firstSignOut.then(() => { settled = true; });
    });
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(8_100);
    });

    expect(settled).toBe(true);
    expect(h.signOutCalls).toBe(1);
    expect(h.realtimeDisconnectCalls).toBe(1);
    expect(h.removeAllChannelsCalls).toBe(1);
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(sessionStorage.getItem('sb-example-auth-token')).toBeNull();
    expect(localStorage.getItem('parium_cached_profile')).toBeNull();
  });

  it('does not let best-effort device-session cleanup block credential logout indefinitely', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    h.removeSessionResult = new Promise(() => {});
    h.signOutResult = Promise.resolve({ error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    vi.useFakeTimers();
    let signOutPromise!: Promise<void>;
    act(() => {
      signOutPromise = latestSignOut!();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });

    expect(h.removeSessionCalls).toBe(1);
    expect(h.signOutCalls).toBe(1);
    await act(async () => { await signOutPromise; });
  });

  it('aborts sign-out without clearing account state when a note flush fails', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    localStorage.setItem('parium_cached_profile', JSON.stringify({
      id: 'profile-user-b',
      user_id: 'user-b',
      first_name: 'Cached Bea',
      role: 'job_seeker',
      onboarding_completed: true,
    }));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    const onFlush = (event: Event) => {
      const detail = (event as CustomEvent<{
        waitUntil: (flush: Promise<unknown>) => void;
      }>).detail;
      detail.waitUntil(Promise.reject(new Error('pending note was not saved')));
    };
    window.addEventListener('parium:flush-pending-notes-before-sign-out', onFlush);

    await act(async () => { await latestSignOut!(); });
    window.removeEventListener('parium:flush-pending-notes-before-sign-out', onFlush);

    expect(screen.getByTestId('user').textContent).toBe('user-b');
    expect(localStorage.getItem('parium_cached_profile')).not.toBeNull();
  });

  it('fails closed when the current account has a durable pending note but no mounted flush listener', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    const pendingKey = 'jobseeker_notes_cache_user-b__pending';
    const pendingValue = JSON.stringify({
      v: 1,
      u: 'user-b',
      c: 'Unsaved note that must survive logout',
      t: Date.now(),
    });
    localStorage.setItem(pendingKey, pendingValue);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    await act(async () => { await latestSignOut!(); });

    expect(h.removeSessionCalls).toBe(0);
    expect(h.signOutCalls).toBe(0);
    expect(screen.getByTestId('user').textContent).toBe('user-b');
    expect(localStorage.getItem(pendingKey)).toBe(pendingValue);
  });

  it('fails closed when a pending note appears during device-session cleanup', async () => {
    sessionStorage.setItem('parium_cache_owner', 'user-b');
    let resolveRemoveSession!: () => void;
    h.removeSessionResult = new Promise<void>((resolve) => { resolveRemoveSession = resolve; });
    h.signOutResult = Promise.resolve({ error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-b'));

    let signOutPromise!: Promise<void>;
    act(() => {
      signOutPromise = latestSignOut!();
    });
    await waitFor(() => expect(h.removeSessionCalls).toBe(1));

    const pendingKey = 'employer_notes_cache_user-b__pending';
    const pendingValue = JSON.stringify({
      v: 1,
      u: 'user-b',
      c: 'Edit created while logout was waiting',
      t: Date.now(),
    });
    localStorage.setItem(pendingKey, pendingValue);

    await act(async () => {
      resolveRemoveSession();
      await signOutPromise;
    });

    expect(h.signOutCalls).toBe(0);
    expect(h.restoreSessionRegistrationCalls).toBe(1);
    expect(screen.getByTestId('user').textContent).toBe('user-b');
    expect(localStorage.getItem(pendingKey)).toBe(pendingValue);
  });

  it.each([
    ['another user', { id: 'profile-user-a', user_id: 'user-a', first_name: 'Cached Alice' }],
    ['no explicit user', { id: 'profile-unowned', first_name: 'Unowned Cache' }],
  ])('discards a cached profile with %s ownership when offline', async (_label, cachedProfile) => {
    localStorage.setItem('parium_cached_profile', JSON.stringify(cachedProfile));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('profile').textContent).toBe('none');
    expect(localStorage.getItem('parium_cached_profile')).toBeNull();
  });
});
