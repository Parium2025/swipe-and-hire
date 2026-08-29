/**
 * RED: Jobbsökarens Home-kort ska vara tangentbordsåtkomliga.
 * - Karriärtips med source_url ska exponera länksemantik, vara fokuserbara
 *   och reagera på Enter/Space med samma säkra window.open som klick.
 * - Karriärtips utan source_url ska förbli icke-interaktiva (inget tabbstopp/länkroll).
 * - Varje intervju-rad ska exponera knappsemantik, vara fokuserbar och
 *   Enter/Space ska trigga exakt samma åtgärd som klick
 *   (video+mötes-URL -> ny flik, kontor -> navigering till /my-applications).
 * - DB-stödda location_type 'phone' ska rendera Telefon-label/ikon istället
 *   för tom label/kalender-fallback.
 * Visuella klasser/layout ingår inte i testet.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

const tipsMock = vi.fn();
vi.mock('@/hooks/useCareerTips', () => ({
  useCareerTips: () => tipsMock(),
}));

const interviewsMock = vi.fn();
vi.mock('@/hooks/useInterviews', () => ({
  useCandidateInterviews: () => interviewsMock(),
}));

import { MemoryRouter } from 'react-router-dom';
import { CareerTipsCard } from '../CareerTipsCard';
import { JobSeekerInterviewsCard } from '../JobSeekerInterviewsCard';

const openSpy = vi.fn();

const renderCareerTips = (tips: unknown[]) => {
  tipsMock.mockReturnValue({ data: tips, isLoading: false, error: null });
  return render(
    <MemoryRouter>
      <CareerTipsCard isPaused={true} setIsPaused={() => {}} />
    </MemoryRouter>,
  );
};

const future = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

const renderInterviews = (interviews: unknown[]) => {
  interviewsMock.mockReturnValue({ interviews, isLoading: false });
  return render(
    <MemoryRouter>
      <JobSeekerInterviewsCard />
    </MemoryRouter>,
  );
};

describe('Home-kort tangentbordsåtkomst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.open = openSpy;
  });

  afterEach(() => {
    cleanup();
  });

  describe('CareerTipsCard', () => {
    it('tip med source_url är fokuserbart, exponerar länksemantik och Enter/Space öppnar säkert i ny flik', () => {
      renderCareerTips([
        {
          id: 'tip-1',
          title: 'Så skriver du ett starkt CV',
          summary: 'Bra tips',
          source: 'Arbetsförmedlingen',
          source_url: 'https://example.com/cv-tips',
          published_at: null,
        },
      ]);

      const link = screen.getByRole('link', { name: /Så skriver du ett starkt CV/i });
      expect(link).toHaveAttribute('tabIndex', '0');

      openSpy.mockClear();
      fireEvent.keyDown(link, { key: 'Enter' });
      expect(openSpy).toHaveBeenCalledWith('https://example.com/cv-tips', '_blank', 'noopener,noreferrer');

      openSpy.mockClear();
      fireEvent.keyDown(link, { key: ' ' });
      expect(openSpy).toHaveBeenCalledWith('https://example.com/cv-tips', '_blank', 'noopener,noreferrer');

      // Klick triggar samma säkra åtgärd
      openSpy.mockClear();
      fireEvent.click(link);
      expect(openSpy).toHaveBeenCalledWith('https://example.com/cv-tips', '_blank', 'noopener,noreferrer');
    });

    it('tip utan source_url förblir icke-interaktivt (ingen länkroll eller tabbstopp)', () => {
      renderCareerTips([
        {
          id: 'tip-2',
          title: 'AI-genererat karriärtips',
          summary: 'Ingen källa',
          source: 'Parium',
          source_url: null,
          published_at: null,
        },
      ]);

      expect(screen.queryByRole('link')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
      // Titeln ska fortfarande renderas normalt
      expect(screen.getByText('AI-genererat karriärtips')).toBeInTheDocument();
    });
  });

  describe('JobSeekerInterviewsCard', () => {
    it('video-intervju med mötes-URL är fokuserbar, exponerar knappsemantik och Enter/Space öppnar säkert i ny flik', () => {
      renderInterviews([
        {
          id: 'int-1',
          scheduled_at: future(),
          duration_minutes: 60,
          location_type: 'video',
          location_details: 'https://meet.example.com/abc',
          job_postings: { title: 'Frontendutvecklare', workplace_name: 'Acme AB' },
        },
      ]);

      const row = screen.getByRole('button', { name: /Frontendutvecklare/i });
      expect(row).toHaveAttribute('tabIndex', '0');

      fireEvent.keyDown(row, { key: 'Enter' });
      expect(openSpy).toHaveBeenCalledWith('https://meet.example.com/abc', '_blank', 'noopener,noreferrer');
      expect(navigateSpy).not.toHaveBeenCalled();

      openSpy.mockClear();
      fireEvent.keyDown(row, { key: ' ' });
      expect(openSpy).toHaveBeenCalledWith('https://meet.example.com/abc', '_blank', 'noopener,noreferrer');
    });

    it('kontorsintervju är fokuserbar och Enter/Space navigerar till /my-applications precis som klick', () => {
      renderInterviews([
        {
          id: 'int-2',
          scheduled_at: future(),
          duration_minutes: 45,
          location_type: 'office',
          location_details: 'Storgatan 1, Stockholm',
          job_postings: { title: 'Projektledare', workplace_name: 'Beta AB' },
        },
      ]);

      const row = screen.getByRole('button', { name: /Projektledare/i });
      expect(row).toHaveAttribute('tabIndex', '0');

      fireEvent.keyDown(row, { key: 'Enter' });
      expect(navigateSpy).toHaveBeenCalledWith('/my-applications');

      navigateSpy.mockClear();
      fireEvent.keyDown(row, { key: ' ' });
      expect(navigateSpy).toHaveBeenCalledWith('/my-applications');
      expect(openSpy).not.toHaveBeenCalled();
    });

    it("location_type 'phone' renderar label 'Telefon' istället för tom/kalender-fallback", () => {
      renderInterviews([
        {
          id: 'int-3',
          scheduled_at: future(),
          duration_minutes: 30,
          location_type: 'phone',
          location_details: '070-123 45 67',
          job_postings: { title: 'Säljare', workplace_name: 'Gamma AB' },
        },
      ]);

      expect(screen.getByText('Telefon')).toBeInTheDocument();
    });
  });
});
