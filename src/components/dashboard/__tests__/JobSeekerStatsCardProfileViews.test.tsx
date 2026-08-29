/**
 * Regressionstest: JobSeekerStatsCard får inte skriva hookens fallback-nolla till
 * den user-scopade statistikkachen innan ett lyckat profilvisningssvar,
 * eller efter ett RPC-fel. En lyckad nolla ska däremot skrivas.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readCachedStats, JOBSEEKER_STATS_CACHE_PREFIX } from '@/lib/jobseekerStatsCache';

const USER_ID = 'jobseeker-card-user-1';
const CACHE_KEY = `${JOBSEEKER_STATS_CACHE_PREFIX}${USER_ID}`;

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

// Narrow mocks för oberoende kortberoenden.
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

vi.mock('@/components/dashboard/StatsCarousel', () => ({
  StatsCarousel: () => null,
}));

import { JobSeekerStatsCard } from '@/components/dashboard/JobSeekerStatsCard';

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <JobSeekerStatsCard isPaused={false} setIsPaused={() => undefined} />
    </QueryClientProvider>,
  );
}

describe('JobSeekerStatsCard profile_views cache guard', () => {
  beforeEach(() => {
    rpcSpy.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skriver inte fallback-nollan över ett cachat värde när profilvisnings-RPC:en misslyckas', async () => {
    // Seed: användaren hade 42 profilvisningar sist.
    localStorage.setItem(CACHE_KEY, JSON.stringify({ profile_views: 42 }));

    rpcSpy.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });

    renderCard();

    await waitFor(() => expect(rpcSpy).toHaveBeenCalled());
    // Ge effekterna en chans att köra.
    await new Promise((r) => setTimeout(r, 50));

    // Önskat beteende: 42 ska ligga kvar. Nuvarande kod skriver fallback-0
    // direkt vid mount → detta ska FAILA nu.
    expect(readCachedStats(USER_ID).profile_views).toBe(42);
  });

  it('skriver en legitim nolla när profilvisnings-RPC:en lyckas med noll', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ profile_views: 42 }));

    rpcSpy.mockResolvedValue({
      data: { unique_viewers_30d: 0, total_views: 0, last_viewed_at: null },
      error: null,
    });

    renderCard();

    await waitFor(() => expect(readCachedStats(USER_ID).profile_views).toBe(0));
  });

  it('skriver det sanna värdet vid lyckat RPC-svar', async () => {
    rpcSpy.mockResolvedValue({
      data: { unique_viewers_30d: 7, total_views: 20, last_viewed_at: null },
      error: null,
    });

    renderCard();

    await waitFor(() => expect(readCachedStats(USER_ID).profile_views).toBe(7));
  });
});
