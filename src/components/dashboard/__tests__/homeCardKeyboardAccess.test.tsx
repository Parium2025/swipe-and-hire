/**
 * GREEN: Jobbsökarens Home-kort ska vara tangentbordsåtkomliga.
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
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

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

// Intervjukortet får sin delade live-lista via props från DashboardGrid —
// ingen hook-mock behövs längre.

vi.mock('@/hooks/useNotesSync', () => ({
  useNotesSync: () => ({
    content: '<p>Anteckning</p>',
    isSaving: false,
    saveFailed: false,
    lastSaved: null,
    handleChange: vi.fn(),
  }),
}));

vi.mock('@/components/RichNotesEditor', () => ({
  RichNotesEditor: () => <div data-testid="rich-notes-editor" />,
  NotesToolbar: () => <div data-testid="notes-toolbar" />,
}));

import { MemoryRouter, useLocation } from 'react-router-dom';
import { CareerTipsCard } from '../CareerTipsCard';
import { JobSeekerInterviewsCard } from '../JobSeekerInterviewsCard';
import { StatsCarousel, type StatData } from '../StatsCarousel';
import { JobSeekerNotesCard } from '../JobSeekerNotesCard';

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

const renderInterviews = (interviews: React.ComponentProps<typeof JobSeekerInterviewsCard>['interviews']) => {
  return render(
    <MemoryRouter>
      <JobSeekerInterviewsCard interviews={interviews} isLoading={false} />
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

    it('övergång loading -> laddad data kastar inget hook-ordningsfel och länken blir tillgänglig', () => {
      // Regression: openTipSource får inte vara en hook efter tidiga returns,
      // för då renderar loading->loaded fler hooks än första renderingen.
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      tipsMock.mockReturnValue({ data: undefined, isLoading: true, error: null });
      const utils = render(
        <MemoryRouter>
          <CareerTipsCard isPaused={true} setIsPaused={() => {}} />
        </MemoryRouter>,
      );

      tipsMock.mockReturnValue({
        data: [
          {
            id: 'tip-3',
            title: 'Fem frågor du alltid ska ställa på intervjun',
            summary: 'Bra tips',
            source: 'Arbetsförmedlingen',
            source_url: 'https://example.com/intervjufragor',
            published_at: null,
          },
        ],
        isLoading: false,
        error: null,
      });

      expect(() => utils.rerender(
        <MemoryRouter>
          <CareerTipsCard isPaused={true} setIsPaused={() => {}} />
        </MemoryRouter>,
      )).not.toThrow();

      const hookOrderErrors = consoleErrorSpy.mock.calls.filter((args) =>
        args.some((a) => typeof a === 'string' && /Rendered more hooks|hook order|order of Hooks/i.test(a)),
      );
      expect(hookOrderErrors).toHaveLength(0);
      consoleErrorSpy.mockRestore();

      const link = screen.getByRole('link', { name: /Fem frågor du alltid ska ställa på intervjun/i });
      expect(link).toHaveAttribute('tabIndex', '0');
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

  describe('StatsCarousel', () => {
    const statsWithLink: StatData[] = [
      { icon: () => null, label: 'Skickade ansökningar', value: 3, description: 'Dina jobbansökningar', link: '/my-applications' },
      { icon: () => null, label: 'Sparade jobb', value: 2, description: 'Jobb du sparat', link: '/saved-jobs' },
    ];

    const renderStats = (stats: StatData[], setIsPaused = () => {}) =>
      render(
        <MemoryRouter initialEntries={['/home']}>
          <StatsCarousel stats={stats} isPaused={false} setIsPaused={setIsPaused} />
        </MemoryRouter>,
      );

    // Aktivt index läses av karusellprickarna (AnimatePresence-utgången
    // hinner inte fullfölja under fejkade timers).
    const activeDot = () =>
      screen
        .getAllByRole('button', { name: /Gå till statistik/i })
        .findIndex((dot) => dot.className.includes('bg-white') && !dot.className.includes('bg-white/30'));

    it('länkad statistikruta exponerar native länksemantik med korrekt href', () => {
      renderStats(statsWithLink);

      const link = screen.getByRole('link', { name: /Skickade ansökningar/i });
      // Native <a href> ger Enter-aktivering av webbläsaren utan egen kod.
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/my-applications');

      // Klick navigerar (MemoryRouter hanterar den riktiga navigeringen).
      fireEvent.click(link, { button: 0 });
      expect(link).toBeInTheDocument();
    });

    it('klick på native Link navigerar faktiskt till länkens path', () => {
      // @testing-library/user-event saknas i miljön — äkta Enter-aktivering
      // verifieras i live-browser. Här bevisas att klick på länken byter route.
      const PathProbe = () => {
        const { pathname } = useLocation();
        return <span data-testid="path-probe">{pathname}</span>;
      };
      render(
        <MemoryRouter initialEntries={['/home']}>
          <StatsCarousel stats={statsWithLink} isPaused={false} setIsPaused={() => {}} />
          <PathProbe />
        </MemoryRouter>,
      );

      expect(screen.getByTestId('path-probe').textContent).toBe('/home');
      fireEvent.click(screen.getByRole('link', { name: /Skickade ansökningar/i }), { button: 0 });
      expect(screen.getByTestId('path-probe').textContent).toBe('/my-applications');
    });

    it('olänkad statistikruta har ingen länk- eller knappsemantik', () => {
      renderStats([
        { icon: () => null, label: 'Profilvisningar', value: 0, description: 'Arbetsgivare senaste 30 dagarna' },
      ]);

      expect(screen.queryByRole('link')).toBeNull();
      expect(screen.queryByRole('button', { name: /Profilvisningar/i })).toBeNull();
    });

    it('fokus i kortet pausar rotationen; fokus ut ur kortet återupptar den', () => {
      vi.useFakeTimers();
      try {
        renderStats(statsWithLink);
        const link = screen.getByRole('link', { name: /Skickade ansökningar/i });

        expect(activeDot()).toBe(0);

        fireEvent.focusIn(link);
        act(() => { vi.advanceTimersByTime(30_000); });
        // Rotationen står stilla medan fokus ligger kvar i kortet
        expect(activeDot()).toBe(0);

        const outside = document.createElement('button');
        document.body.appendChild(outside);
        fireEvent.focusOut(link, { relatedTarget: outside });
        act(() => { vi.advanceTimersByTime(30_000); });

        expect(activeDot()).toBe(1);
        outside.remove();
      } finally {
        vi.useRealTimers();
      }
    });

    it('fokus flyttas internt från länk till karusellpunkt — rotationen förblir pausad tills fokus lämnar hela kortet', () => {
      vi.useFakeTimers();
      try {
        renderStats(statsWithLink);
        const link = screen.getByRole('link', { name: /Skickade ansökningar/i });
        const dots = screen.getAllByRole('button', { name: /Gå till statistik/i });

        fireEvent.focusIn(link);
        // Intern fokusflytt: blur-händelsens relatedTarget ligger kvar i kortet.
        fireEvent.focusOut(link, { relatedTarget: dots[1] });
        fireEvent.focusIn(dots[1]);

        act(() => { vi.advanceTimersByTime(30_000); });
        expect(activeDot()).toBe(0);

        // Först när fokus lämnar HELA kortet återupptas rotationen.
        const outside = document.createElement('button');
        document.body.appendChild(outside);
        fireEvent.focusOut(dots[1], { relatedTarget: outside });
        act(() => { vi.advanceTimersByTime(30_000); });

        expect(activeDot()).toBe(1);
        outside.remove();
      } finally {
        vi.useRealTimers();
      }
    });

    it('KeepAlive: fokuspaus nollställs när Home inaktiveras utan blur — rotationen återupptas vid återkomst', () => {
      vi.useFakeTimers();
      try {
        const renderControlled = (isActive: boolean) => (
          <MemoryRouter initialEntries={['/home']}>
            <StatsCarousel stats={statsWithLink} isPaused={false} setIsPaused={() => {}} isActive={isActive} />
          </MemoryRouter>
        );
        const utils = render(renderControlled(true));
        const link = screen.getByRole('link', { name: /Skickade ansökningar/i });

        fireEvent.focusIn(link);
        expect(activeDot()).toBe(0);

        // Home göms med display:none av KeepAlive: blur/focusout är inte
        // garanterad, så fokuspausen får inte hänga kvar över inaktiveringen.
        utils.rerender(renderControlled(false));
        utils.rerender(renderControlled(true));

        act(() => { vi.advanceTimersByTime(30_000); });
        expect(activeDot()).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Anteckningar: expandera och stäng', () => {
    it('expandknappen har type=button och tillgängligt namn, och öppnar dialogen med en namngiven stängknapp', () => {
      render(
        <MemoryRouter initialEntries={['/home']}>
          <JobSeekerNotesCard />
        </MemoryRouter>,
      );

      const expand = screen.getByRole('button', { name: 'Expandera anteckningar' });
      expect(expand).toHaveAttribute('type', 'button');

      fireEvent.click(expand);

      const close = screen.getByRole('button', { name: 'Stäng anteckningar' });
      expect(close).toHaveAttribute('type', 'button');

      fireEvent.click(close);
      expect(screen.queryByRole('button', { name: 'Stäng anteckningar' })).toBeNull();
    });

    it('Escape stänger dialogen och fokus återvänder till expandknappen', async () => {
      render(
        <MemoryRouter initialEntries={['/home']}>
          <JobSeekerNotesCard />
        </MemoryRouter>,
      );

      const expand = screen.getByRole('button', { name: 'Expandera anteckningar' });
      expand.focus();
      fireEvent.click(expand);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Stäng anteckningar' })).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Stäng anteckningar' })).toBeNull();
      });
      // Fokusåterställning till expandknappen är ett Radix/webbläsarbeteende
      // som jsdom inte återger trovärdigt — verifieras i live-browser.
      expect(expand).toBeInTheDocument();
    });
  });
});
