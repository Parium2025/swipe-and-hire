/**
 * Home hålls monterad av KeepAlive. Presentationsrotationer, pause-timers och
 * det expanderade anteckningsfönstret får inte leva vidare när Home är dold.
 * Data, sparande och realtid lämnas orörda.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Activity } from 'lucide-react';

const notesSyncMount = vi.fn();
vi.mock('@/hooks/useNotesSync', () => ({
  useNotesSync: () => {
    notesSyncMount();
    return {
      content: '<p>hej</p>',
      isSaving: false,
      saveFailed: false,
      lastSaved: null,
      handleChange: vi.fn(),
    };
  },
}));

vi.mock('@/components/RichNotesEditor', () => ({
  RichNotesEditor: () => <div data-testid="editor" />,
  NotesToolbar: () => <div data-testid="toolbar" />,
}));

vi.mock('./../ExpandedNotesDialog', () => ({
  ExpandedNotesDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="expanded-notes" /> : null,
}));

vi.mock('@/hooks/useCareerTips', () => ({
  useCareerTips: () => ({
    data: [
      { id: '1', title: 'Tips ett', summary: 'A', source: 'X', source_url: null, published_at: null },
      { id: '2', title: 'Tips två', summary: 'B', source: 'X', source_url: null, published_at: null },
    ],
    isLoading: false,
    error: null,
  }),
}));

import { StatsCarousel } from '../StatsCarousel';
import { CareerTipsCard } from '../CareerTipsCard';
import { JobSeekerNotesCard } from '../JobSeekerNotesCard';
import { useCardInteractionPause } from '@/hooks/useCardInteractionPause';

const stats = [
  { icon: Activity, label: 'Ett', value: 1, description: 'a' },
  { icon: Activity, label: 'Två', value: 2, description: 'b' },
];

function rotationTimers(
  timeoutSpy: ReturnType<typeof vi.spyOn>,
  intervalSpy: ReturnType<typeof vi.spyOn>,
) {
  const timeouts = timeoutSpy.mock.calls.filter((c) => Number(c[1]) > 0 && Number(c[1]) <= 10_000);
  const intervals = intervalSpy.mock.calls.filter((c) => Number(c[1]) === 10_000);
  return timeouts.length + intervals.length;
}

describe('Home-kortens rotation pausas när Home är inaktiv', () => {
  let timeoutSpy: ReturnType<typeof vi.spyOn>;
  let intervalSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    intervalSpy = vi.spyOn(globalThis, 'setInterval');
  });

  afterEach(() => {
    timeoutSpy.mockRestore();
    intervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('StatsCarousel schemalägger ingen rotation när isActive=false och visar samma kort', () => {
    const { rerender } = render(
      <MemoryRouter>
        <StatsCarousel stats={stats} isPaused={false} setIsPaused={() => {}} isActive={false} />
      </MemoryRouter>,
    );

    expect(rotationTimers(timeoutSpy, intervalSpy)).toBe(0);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('Ett')).toBeTruthy();

    timeoutSpy.mockClear();
    intervalSpy.mockClear();
    rerender(
      <MemoryRouter>
        <StatsCarousel stats={stats} isPaused={false} setIsPaused={() => {}} isActive={true} />
      </MemoryRouter>,
    );
    expect(rotationTimers(timeoutSpy, intervalSpy)).toBe(1);
  });

  it('CareerTipsCard schemalägger ingen rotation när isActive=false', () => {
    render(<CareerTipsCard isPaused={false} setIsPaused={() => {}} isActive={false} />);
    expect(rotationTimers(timeoutSpy, intervalSpy)).toBe(0);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('Tips ett')).toBeTruthy();
  });

  it('upprepade aktiveringscykler håller antalet rotationstimers begränsat', () => {
    const { rerender } = render(
      <MemoryRouter>
        <StatsCarousel stats={stats} isPaused={false} setIsPaused={() => {}} isActive={true} />
      </MemoryRouter>,
    );
    for (let i = 0; i < 5; i++) {
      rerender(
        <MemoryRouter>
          <StatsCarousel stats={stats} isPaused={false} setIsPaused={() => {}} isActive={false} />
        </MemoryRouter>,
      );
      rerender(
        <MemoryRouter>
          <StatsCarousel stats={stats} isPaused={false} setIsPaused={() => {}} isActive={true} />
        </MemoryRouter>,
      );
    }
    timeoutSpy.mockClear();
    intervalSpy.mockClear();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(rotationTimers(timeoutSpy, intervalSpy)).toBeLessThanOrEqual(1);
  });
});

describe('useCardInteractionPause städar timers vid inaktivering', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('avbryter väntande resume/safety-timeouts och sätter inte pausläge efteråt', () => {
    const setIsPaused = vi.fn();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useCardInteractionPause({ setIsPaused, active }),
      { initialProps: { active: true } },
    );

    act(() => { result.current.pauseNow(); });
    act(() => { result.current.resumeWithDelay(); });
    setIsPaused.mockClear();

    rerender({ active: false });
    act(() => { vi.advanceTimersByTime(10_000); });

    expect(setIsPaused).not.toHaveBeenCalledWith(true);
    expect(setIsPaused.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('aktivt beteende är oförändrat', () => {
    const setIsPaused = vi.fn();
    const { result } = renderHook(() => useCardInteractionPause({ setIsPaused, active: true }));
    act(() => { result.current.pauseNow(); });
    expect(setIsPaused).toHaveBeenCalledWith(true);
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { result.current.resumeNow(); });
    expect(setIsPaused).toHaveBeenLastCalledWith(false);
  });
});

describe('Expanderade anteckningar stängs när Home blir inaktiv', () => {
  it('stänger dialogen, öppnar inte igen automatiskt och behåller useNotesSync monterad', () => {
    notesSyncMount.mockClear();
    const { rerender } = render(<JobSeekerNotesCard isActive={true} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByTestId('expanded-notes')).toBeTruthy();

    rerender(<JobSeekerNotesCard isActive={false} />);
    expect(screen.queryByTestId('expanded-notes')).toBeNull();
    expect(screen.getByTestId('editor')).toBeTruthy();

    rerender(<JobSeekerNotesCard isActive={true} />);
    expect(screen.queryByTestId('expanded-notes')).toBeNull();
    expect(notesSyncMount.mock.calls.length).toBeGreaterThan(0);
  });
});
