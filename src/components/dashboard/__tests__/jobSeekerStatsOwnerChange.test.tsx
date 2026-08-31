/**
 * RED → GREEN: Home-statistiken har staleTime: Infinity och refetchOnMount.
 * Om användaren byts medan Home är aktiv och den nya användarens nyckel redan
 * har en varm (gammal) cache sker ingen hämtning alls — och gammal ägares
 * värde får aldrig visas eller skrivas under övergången.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({ userId: 'js-1' }));
const fetchJobseekerDashboardStats = vi.fn();
const writeCachedStat = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: h.userId } }),
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
  writeCachedStat: (...args: unknown[]) => writeCachedStat(...(args as [])),
}));
vi.mock('@/lib/jobseekerDashboardStats', () => ({
  fetchJobseekerDashboardStats: (...args: unknown[]) =>
    fetchJobseekerDashboardStats(...(args as [])),
}));

import { JobSeekerStatsCard } from '../JobSeekerStatsCard';

let queryClient: QueryClient;

const renderCard = () => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <JobSeekerStatsCard isPaused setIsPaused={() => {}} isActive />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(tree());
  return { rerender: () => view.rerender(tree()) };
};

describe('JobSeekerStatsCard — ägarbyte medan Home är aktivt', () => {
  beforeEach(() => {
    h.userId = 'js-1';
    fetchJobseekerDashboardStats.mockReset();
    writeCachedStat.mockReset();
    fetchJobseekerDashboardStats.mockResolvedValue({
      applications: 1,
      saved_jobs: 0,
      unread_messages: 0,
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  afterEach(() => cleanup());

  it('varm cache för nya ägaren hämtas om, och gamla ägarens värde visas aldrig', async () => {
    const { rerender } = renderCard();
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

    // B har en varm men inaktuell cache sedan tidigare i sessionen.
    queryClient.setQueryData(['jobseeker-dashboard-stats', 'js-2'], {
      applications: 5,
      saved_jobs: 0,
      unread_messages: 0,
    });
    fetchJobseekerDashboardStats.mockResolvedValue({
      applications: 9,
      saved_jobs: 0,
      unread_messages: 0,
    });

    h.userId = 'js-2';
    await act(async () => {
      rerender();
      await new Promise((r) => setTimeout(r, 150));
    });

    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    const ownersFetched = fetchJobseekerDashboardStats.mock.calls.map((c) => c[0]);
    expect(ownersFetched).toContain('js-2');
    // Ingen skrivning av A:s siffror under B:s ägarskap
    expect(
      writeCachedStat.mock.calls.filter((c) => c[0] === 'js-2' && c[1] === 'applications' && c[2] === 1),
    ).toHaveLength(0);
  });
});
