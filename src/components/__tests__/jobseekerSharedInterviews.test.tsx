/**
 * Delad intervjudatakälla på jobbsökarens Home:
 * - JobSeekerDashboardGrid monterar exakt EN useCandidateInterviews-källa.
 * - Statistikkortet och intervjukortet räknar samma live-lista, även under
 *   en pågående intervju (isInterviewOver-semantik).
 * - Statistikkortet skapar ingen egen realtime-lyssnare på interviews.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const USER_ID = 'shared-interviews-user-1';

let realUseCandidateInterviews: typeof import('@/hooks/useInterviews').useCandidateInterviews;
const candidateInterviewsSpy = vi.fn();
vi.mock('@/hooks/useInterviews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useInterviews')>();
  realUseCandidateInterviews = actual.useCandidateInterviews;
  return {
    ...actual,
    useCandidateInterviews: () => candidateInterviewsSpy(),
  };
});

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

// Fånga props till barnkorten utan att dra in deras beroenden.
const statsCardPropsSpy = vi.fn();
vi.mock('@/components/dashboard/JobSeekerStatsCard', () => ({
  JobSeekerStatsCard: (props: { liveInterviewsCount?: number }) => {
    statsCardPropsSpy(props);
    return null;
  },
}));

const interviewsCardPropsSpy = vi.fn();
vi.mock('@/components/dashboard/JobSeekerInterviewsCard', () => ({
  JobSeekerInterviewsCard: (props: { interviews?: unknown[] }) => {
    interviewsCardPropsSpy(props);
    return null;
  },
}));

vi.mock('@/components/dashboard/CareerTipsCard', () => ({
  CareerTipsCard: () => null,
}));

vi.mock('@/components/dashboard/JobSeekerNotesCard', () => ({
  JobSeekerNotesCard: () => null,
}));

// Mocks för den riktiga JobSeekerStatsCard-rendering i test 3.
const channelRegistrations: Array<{ event: string; table: string; filter?: string }> = [];
vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: () => {
    const channel = {
      on: (_type: string, config: { event: string; table: string; filter?: string }, _cb: unknown) => {
        channelRegistrations.push(config);
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  },
}));

interface InterviewsQueryBuilder {
  select: () => InterviewsQueryBuilder;
  eq: () => InterviewsQueryBuilder;
  gte: () => InterviewsQueryBuilder;
  in: () => InterviewsQueryBuilder;
  order: () => Promise<{ data: unknown[]; error: null }>;
}

const makeInterviewsQueryBuilder = (): InterviewsQueryBuilder => {
  const builder: InterviewsQueryBuilder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    in: () => builder,
    order: () => Promise.resolve({ data: [], error: null }),
  };
  return builder;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: { unique_viewers_30d: 0, total_views: 0, last_viewed_at: null }, error: null })),
    from: () => makeInterviewsQueryBuilder(),
    removeChannel: vi.fn(),
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
    interviews: 99, // RPC-värdet får inte påverka den kanoniska live-räknaren
    saved_jobs: 3,
    unread_messages: 4,
  })),
}));

vi.mock('@/components/dashboard/StatsCarousel', () => ({
  StatsCarousel: () => null,
}));

import { JobSeekerDashboardGrid } from '@/components/JobSeekerDashboardGrid';
import { JobSeekerStatsCard } from '@/components/dashboard/JobSeekerStatsCard';

/** Pågående intervju: startade för 30 min sedan, 60 min lång. */
const inProgressInterview = () => ({
  id: 'int-live-1',
  scheduled_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  duration_minutes: 60,
  location_type: 'video' as const,
  location_details: 'https://meet.example.com/x',
  job_postings: { title: 'Frontendutvecklare', workplace_name: 'Acme AB' },
});

describe('Jobbsökarens delade intervjudatakälla', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelRegistrations.length = 0;
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('DashboardGrid monterar exakt en candidate-interviews-datakälla', () => {
    candidateInterviewsSpy.mockReturnValue({ interviews: [], isLoading: false });

    render(<JobSeekerDashboardGrid />);

    expect(candidateInterviewsSpy).toHaveBeenCalledTimes(1);
  });

  it('statistikräknaren och intervjukortet håller ihop under en pågående intervju', () => {
    candidateInterviewsSpy.mockReturnValue({ interviews: [inProgressInterview()], isLoading: false });

    render(<JobSeekerDashboardGrid />);

    // Intervjun pågår fortfarande → båda korten måste räkna den.
    expect(statsCardPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ liveInterviewsCount: 1, interviewsLoaded: true }),
    );
    expect(interviewsCardPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ interviews: [expect.objectContaining({ id: 'int-live-1' })], isLoading: false }),
    );
  });

  it('statistikkortet skapar ingen egen realtime-lyssnare på interviews', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <JobSeekerStatsCard
          isPaused={false}
          setIsPaused={() => undefined}
          liveInterviewsCount={1}
          interviewsLoaded={true}
        />
      </QueryClientProvider>,
    );

    const interviewListeners = channelRegistrations.filter((c) => c.table === 'interviews');
    expect(interviewListeners).toHaveLength(0);
  });
});
