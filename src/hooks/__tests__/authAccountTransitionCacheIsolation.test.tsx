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
import { render, waitFor, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  userId: 'user-b',
  failQueries: true,
}));

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
  const makeQuery = () => {
    const q = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      in: () => q,
      gte: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: () => Promise.resolve({ data: null, error: failing.error }),
      single: () => Promise.resolve({ data: null, error: failing.error }),
      then: (
        onF?: ((value: ListResult) => unknown) | null,
        onR?: ((reason: unknown) => unknown) | null
      ) => Promise.resolve(failing).then(onF ?? undefined, onR ?? undefined),
    };
    return q;
  };

  const supabase = {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: {
            session: {
              user: { id: h.userId, email: 'b@example.com' },
              access_token: 'token-b',
            },
          },
          error: null,
        }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
      refreshSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
    rpc: () => Promise.resolve({ data: null, error: failing.error }),
    from: () => makeQuery(),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
  };

  return { supabase };
});

import { AuthProvider, useAuth } from '@/hooks/useAuth';

const Probe = () => {
  const { preloadedSavedJobs, preloadedMyApplications, preloadedAvatarUrl } = useAuth();
  return (
    <div>
      <span data-testid="saved">{preloadedSavedJobs}</span>
      <span data-testid="applications">{preloadedMyApplications}</span>
      <span data-testid="avatar">{preloadedAvatarUrl ?? 'none'}</span>
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
    localStorage.clear();
    sessionStorage.clear();
    h.userId = 'user-b';
    h.failQueries = true;
    // Account A left warm caches behind in this tab.
    sessionStorage.setItem('parium_cache_owner', 'user-a');
    sessionStorage.setItem('parium_saved_jobs', '7');
    sessionStorage.setItem('parium_my_applications', '4');
    sessionStorage.setItem('parium_avatar_url', 'https://signed/a-avatar.png');
    localStorage.setItem('job_seeker_interviews_user-a', JSON.stringify({ interviews: [] }));
  });

  afterEach(() => {
    cleanup();
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
});
