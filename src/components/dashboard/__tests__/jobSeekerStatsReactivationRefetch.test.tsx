/**
 * RED → GREEN: Home-statistiken har staleTime: Infinity. När Home går
 * active → inactive → active med varm cache (och ett missat realtime-event)
 * skedde ingen ny hämtning alls — siffrorna kunde vara godtyckligt gamla.
 *
 * Krav:
 *  - äkta false → true (reaktivering) ger exakt EN hämtning för aktuell user
 *  - initial mount med isActive=true dubbelhämtar inte
 *  - inaktiv Home reagerar inte på visibilitychange
 *  - aktiv visibilitychange invaliderar exakt ['jobseeker-dashboard-stats', user.id]
 *    med exact: true
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fetchJobseekerDashboardStats = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'js-1' } }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/contexts/ConversationsContext', () => ({
  useConversationsContext: () => null,
}));
vi.mock('@/hooks/useProfileViewStats', () => ({
  useProfileViewStats: () => ({ stats: { unique_viewers_30d: 0 }, isSuccess: false }),
}));
vi.mock('@/lib/jobseekerStatsCache', () => ({
  readCachedStats: () => ({}),
  writeCachedStat: vi.fn(),
}));
vi.mock('@/lib/jobseekerDashboardStats', () => ({
  fetchJobseekerDashboardStats: (...args: unknown[]) =>
    fetchJobseekerDashboardStats(...(args as [])),
}));

import { JobSeekerStatsCard } from '../JobSeekerStatsCard';

let queryClient: QueryClient;

const renderCard = (isActive: boolean) => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <JobSeekerStatsCard isPaused={false} setIsPaused={() => {}} isActive={isActive} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const rerender = (nextActive: boolean) =>
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <JobSeekerStatsCard isPaused={false} setIsPaused={() => {}} isActive={nextActive} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  return { rerender };
};

const settle = async (ms = 60) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

const setVisibility = (value: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('JobSeekerStatsCard — reaktiveringshämtning med varm cache', () => {
  beforeEach(() => {
    fetchJobseekerDashboardStats.mockReset();
    fetchJobseekerDashboardStats.mockResolvedValue({
      applications: 1,
      saved_jobs: 0,
      unread_messages: 0,
    });
    setVisibility('visible');
  });

  afterEach(() => cleanup());

  it('active → inactive → active hämtar exakt en gång till och visar nya värdet', async () => {
    const { rerender } = renderCard(true);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    expect(fetchJobseekerDashboardStats).toHaveBeenCalledTimes(1);

    act(() => rerender(false));
    await settle();

    // Serverändring som Home missade medan den var dold
    fetchJobseekerDashboardStats.mockResolvedValue({
      applications: 2,
      saved_jobs: 0,
      unread_messages: 0,
    });

    act(() => rerender(true));
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
    expect(fetchJobseekerDashboardStats).toHaveBeenCalledTimes(2);
    expect(fetchJobseekerDashboardStats.mock.calls.every((c) => c[0] === 'js-1')).toBe(true);
  });

  it('initial mount med isActive=true dubbelhämtar inte', async () => {
    renderCard(true);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    await settle(150);
    expect(fetchJobseekerDashboardStats).toHaveBeenCalledTimes(1);
  });

  it('inaktiv Home reagerar inte på visibilitychange', async () => {
    renderCard(false);
    await settle();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      setVisibility('visible');
      await new Promise((r) => setTimeout(r, 2000));
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it('aktiv visibilitychange invaliderar exakt aktuell user-nyckel', async () => {
    renderCard(true);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      setVisibility('visible');
      await new Promise((r) => setTimeout(r, 2000));
    });

    const statsCalls = spy.mock.calls.filter((c) => {
      const key = (c[0] as { queryKey?: unknown[] })?.queryKey;
      return Array.isArray(key) && key[0] === 'jobseeker-dashboard-stats';
    });
    expect(statsCalls).toHaveLength(1);
    expect(statsCalls[0][0]).toEqual({
      queryKey: ['jobseeker-dashboard-stats', 'js-1'],
      exact: true,
    });
  });
});
