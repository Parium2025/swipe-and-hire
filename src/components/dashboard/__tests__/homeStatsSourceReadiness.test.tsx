/**
 * Regressionstest: statistikkortet får inte visa en källas fallback-nolla
 * innan just den källan har lyckats. Cachade värden ska ligga kvar under
 * laddning och efter fel, och tomma tillstånd ska vara källspecifika.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readCachedStats, JOBSEEKER_STATS_CACHE_PREFIX } from '@/lib/jobseekerStatsCache';
import type { StatData } from '@/components/dashboard/StatsCarousel';

const USER_ID = 'jobseeker-readiness-user';
const CACHE_KEY = `${JOBSEEKER_STATS_CACHE_PREFIX}${USER_ID}`;

const rpcSpy = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcSpy(...args),
    removeChannel: vi.fn(),
    from: vi.fn(),
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

vi.mock('@/contexts/ConversationsContext', () => ({
  useConversationsContext: () => null,
}));

vi.mock('@/lib/jobseekerDashboardStats', () => ({
  fetchJobseekerDashboardStats: vi.fn(async () => ({
    applications: 1,
    interviews: 2,
    saved_jobs: 3,
    unread_messages: 4,
  })),
}));

const renderedStats: StatData[][] = [];

vi.mock('@/components/dashboard/StatsCarousel', () => ({
  StatsCarousel: (props: { stats: StatData[] }) => {
    renderedStats.push(props.stats);
    return null;
  },
}));

const fetchCandidateInterviewsForUser = vi.fn();

vi.mock('@/lib/candidateInterviewsFetcher', () => ({
  fetchCandidateInterviewsForUser: (...args: unknown[]) => fetchCandidateInterviewsForUser(...args),
}));

import { JobSeekerStatsCard } from '@/components/dashboard/JobSeekerStatsCard';
import { useCandidateInterviews } from '@/hooks/useInterviews';

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderCard(props: { liveInterviewsCount?: number; interviewsLoaded?: boolean }) {
  return render(
    <QueryClientProvider client={createClient()}>
      <JobSeekerStatsCard isPaused={false} setIsPaused={() => undefined} {...props} />
    </QueryClientProvider>,
  );
}

const latest = () => renderedStats[renderedStats.length - 1];
const statByLabel = (label: string) => latest().find((s) => s.label === label);

describe('Home-statistik: källspecifik readiness', () => {
  beforeEach(() => {
    rpcSpy.mockReset();
    fetchCandidateInterviewsForUser.mockReset();
    renderedStats.length = 0;
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('behåller cachat intervjuantal när intervjukällan ännu inte lyckats', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ interviews: 5 }));
    rpcSpy.mockResolvedValue({
      data: { unique_viewers_30d: 3, total_views: 3, last_viewed_at: null },
      error: null,
    });

    renderCard({ liveInterviewsCount: 0, interviewsLoaded: false });

    await waitFor(() => expect(latest()).toBeTruthy());
    await new Promise((r) => setTimeout(r, 50));

    const interviews = statByLabel('Bokade intervjuer');
    expect(interviews?.value).toBe(5);
    // Inget falskt tomt tillstånd innan källan lyckats.
    expect(interviews?.ready).toBe(false);
    // Ingen nolla får skrivas över det cachade värdet.
    expect(readCachedStats(USER_ID).interviews).toBe(5);
  });

  it('litar på en lyckad tom intervjulista', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ interviews: 5 }));
    rpcSpy.mockResolvedValue({
      data: { unique_viewers_30d: 3, total_views: 3, last_viewed_at: null },
      error: null,
    });

    renderCard({ liveInterviewsCount: 0, interviewsLoaded: true });

    await waitFor(() => expect(statByLabel('Bokade intervjuer')?.value).toBe(0));
    expect(statByLabel('Bokade intervjuer')?.ready).toBe(true);
    await waitFor(() => expect(readCachedStats(USER_ID).interviews).toBe(0));
  });

  it('behåller cachade profilvisningar medan RPC:en är pågående', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ profile_views: 42 }));
    rpcSpy.mockImplementation(() => new Promise(() => undefined));

    renderCard({ liveInterviewsCount: 0, interviewsLoaded: true });

    await waitFor(() => expect(latest()).toBeTruthy());
    await new Promise((r) => setTimeout(r, 50));

    const views = statByLabel('Profilvisningar');
    expect(views?.value).toBe(42);
    expect(views?.ready).toBe(false);
    expect(readCachedStats(USER_ID).profile_views).toBe(42);
  });

  it('behåller cachade profilvisningar när RPC:en misslyckas', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ profile_views: 42 }));
    rpcSpy.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });

    renderCard({ liveInterviewsCount: 0, interviewsLoaded: true });

    await waitFor(() => expect(rpcSpy).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));

    const views = statByLabel('Profilvisningar');
    expect(views?.value).toBe(42);
    expect(views?.ready).toBe(false);
    expect(readCachedStats(USER_ID).profile_views).toBe(42);
  });

  it('litar på en lyckad nolla från profil-RPC:en', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ profile_views: 42 }));
    rpcSpy.mockResolvedValue({
      data: { unique_viewers_30d: 0, total_views: 0, last_viewed_at: null },
      error: null,
    });

    renderCard({ liveInterviewsCount: 0, interviewsLoaded: true });

    await waitFor(() => expect(statByLabel('Profilvisningar')?.value).toBe(0));
    expect(statByLabel('Profilvisningar')?.ready).toBe(true);
    await waitFor(() => expect(readCachedStats(USER_ID).profile_views).toBe(0));
  });

  it('useCandidateInterviews skiljer ett misslyckat anrop från ett tomt lyckat svar', async () => {
    fetchCandidateInterviewsForUser.mockRejectedValue(new Error('network down'));
    const client = createClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCandidateInterviews(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isSuccess).toBe(false);
  });
});
