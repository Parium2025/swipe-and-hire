/**
 * Intervjukortet får aldrig presentera ett misslyckat anrop som ett lyckat
 * tomt resultat.
 * - Fel utan cache → kompakt felstatus med role="alert" och "Försök igen".
 * - Retry-knappen anropar queryns refetch.
 * - Cachade/placeholder-rader ligger kvar vid refetch-fel.
 * - Endast ett verkligt lyckat tomt svar visar "Inga bokade intervjuer".
 * - Loading/placeholder/fel får inte auktorisera en falsk noll-cache.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const candidateInterviewsSpy = vi.fn();
vi.mock('@/hooks/useInterviews', () => ({
  useCandidateInterviews: () => candidateInterviewsSpy(),
}));

const statsCardPropsSpy = vi.fn();
vi.mock('@/components/dashboard/JobSeekerStatsCard', () => ({
  JobSeekerStatsCard: (props: Record<string, unknown>) => {
    statsCardPropsSpy(props);
    return null;
  },
}));

vi.mock('@/components/dashboard/CareerTipsCard', () => ({ CareerTipsCard: () => null }));
vi.mock('@/components/dashboard/JobSeekerNotesCard', () => ({ JobSeekerNotesCard: () => null }));

import { JobSeekerInterviewsCard } from '@/components/dashboard/JobSeekerInterviewsCard';
import { JobSeekerDashboardGrid } from '@/components/JobSeekerDashboardGrid';

const interview = (id = 'int-1') => ({
  id,
  scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  duration_minutes: 60,
  location_type: 'video' as const,
  location_details: 'https://meet.example.com/x',
  job_postings: { title: 'Frontendutvecklare', workplace_name: 'Acme AB' },
});

describe('Intervjukortets felhantering', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('visar felstatus istället för tom-success-text när första laddningen felar utan cache', () => {
    render(
      <JobSeekerInterviewsCard interviews={[]} isLoading={false} isError onRetry={() => undefined} />,
    );

    expect(screen.queryByText('Inga bokade intervjuer')).toBeNull();
    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(screen.getByRole('button', { name: /Försök igen/i })).toBeTruthy();
  });

  it('retry-knappen anropar refetch', () => {
    const onRetry = vi.fn();
    render(<JobSeekerInterviewsCard interviews={[]} isLoading={false} isError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /Försök igen/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('behåller cachade rader vid refetch-fel', () => {
    render(
      <JobSeekerInterviewsCard
        interviews={[interview()]}
        isLoading={false}
        isError
        onRetry={() => undefined}
      />,
    );

    expect(screen.getByText('Frontendutvecklare')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Inga bokade intervjuer')).toBeNull();
  });

  it('visar tom-texten endast vid verkligt lyckat tomt svar', () => {
    render(<JobSeekerInterviewsCard interviews={[]} isLoading={false} isError={false} onRetry={() => undefined} />);
    expect(screen.getByText('Inga bokade intervjuer')).toBeTruthy();
  });

  it('grid skickar fel/retry och auktoriserar ingen noll-cache vid placeholder eller fel', () => {
    const refetch = vi.fn();
    candidateInterviewsSpy.mockReturnValue({
      interviews: [],
      isLoading: false,
      isSuccess: true, // placeholderData gör status success
      isError: false,
      isPlaceholderData: true,
      refetch,
    });

    const { unmount } = render(<JobSeekerDashboardGrid />);
    expect(statsCardPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ interviewsLoaded: false }),
    );
    unmount();
    cleanup();
    statsCardPropsSpy.mockClear();

    candidateInterviewsSpy.mockReturnValue({
      interviews: [],
      isLoading: false,
      isSuccess: false,
      isError: true,
      isPlaceholderData: false,
      refetch,
    });

    render(<JobSeekerDashboardGrid />);
    expect(statsCardPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ interviewsLoaded: false }),
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Försök igen/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
