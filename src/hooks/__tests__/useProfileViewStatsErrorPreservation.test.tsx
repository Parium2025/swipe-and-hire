/**
 * Regressionstest: useProfileViewStats får inte omvandla ett RPC-fel till ett
 * "lyckat" nollsvar. Vid fel ska querytillståndet vara error och tidigare
 * lyckad data ska finnas kvar. Vid lyckat svar ska värdet exponeras —
 * även en legitim nolla.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const USER_ID = 'jobseeker-stats-user-1';

const rpcSpy = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcSpy(...args),
    removeChannel: vi.fn(),
  },
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

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: USER_ID },
    userRole: { role: 'job_seeker' },
  }),
}));

import { useProfileViewStats } from '@/hooks/useProfileViewStats';

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useProfileViewStats error preservation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    rpcSpy.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exponerar det sanna värdet vid lyckat RPC-svar', async () => {
    rpcSpy.mockResolvedValue({
      data: { unique_viewers_30d: 7, total_views: 20, last_viewed_at: '2026-08-29T10:00:00Z' },
      error: null,
    });

    const { result } = renderHook(() => useProfileViewStats(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.stats.unique_viewers_30d).toBe(7));
    expect(queryClient.getQueryState(['profile-view-stats', USER_ID])?.status).toBe('success');
  });

  it('exponerar en legitim nolla vid lyckat noll-svar', async () => {
    rpcSpy.mockResolvedValue({
      data: { unique_viewers_30d: 0, total_views: 0, last_viewed_at: null },
      error: null,
    });

    const { result } = renderHook(() => useProfileViewStats(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(
      () => expect(queryClient.getQueryState(['profile-view-stats', USER_ID])?.status).toBe('success'),
    );
    expect(result.current.stats.unique_viewers_30d).toBe(0);
  });

  it('ger error-status (inte ett lyckat nollsvar) när RPC:en misslyckas', async () => {
    rpcSpy.mockResolvedValue({
      data: null,
      error: { message: 'rpc failed' },
    });

    renderHook(() => useProfileViewStats(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(rpcSpy).toHaveBeenCalled());

    // Önskat beteende: queryn ska vara i error-tillstånd. Nuvarande kod
    // returnerar DEFAULT-nollor som ett lyckat svar → detta ska FAILA nu.
    expect(queryClient.getQueryState(['profile-view-stats', USER_ID])?.status).toBe('error');
  });

  it('behåller tidigare lyckad data i React Query efter ett RPC-fel', async () => {
    // Först ett lyckat svar som etablerar data.
    rpcSpy.mockResolvedValueOnce({
      data: { unique_viewers_30d: 9, total_views: 30, last_viewed_at: null },
      error: null,
    });

    const { result } = renderHook(() => useProfileViewStats(), {
      wrapper: makeWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.stats.unique_viewers_30d).toBe(9));

    // Sedan fel vid omhämtning (t.ex. via realtime-invalidering).
    rpcSpy.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });
    await queryClient.invalidateQueries({ queryKey: ['profile-view-stats', USER_ID] });
    await waitFor(
      () => expect(queryClient.getQueryState(['profile-view-stats', USER_ID])?.status).toBe('error'),
    );

    // Det gamla värdet ska fortfarande vara det som visas.
    expect(result.current.stats.unique_viewers_30d).toBe(9);
  });
});
