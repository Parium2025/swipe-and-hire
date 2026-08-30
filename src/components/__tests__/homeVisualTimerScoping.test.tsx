/**
 * RED: Home hålls monterad av KeepAlive. Home-egna visuella klockor
 * (datum/tid, hälsning, intervjukortets minuttick) och WeatherEffects får
 * inte fortsätta köra medan Home är dold. /index tillhör Search och räknas
 * ALDRIG som Home-aktiv; /home gör det.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: { first_name: 'Alice', location: 'Stockholm' }, user: { id: 'u1' } }),
}));

vi.mock('@/hooks/useWeather', () => ({
  useWeather: () => ({
    city: 'Stockholm',
    temperature: 5,
    feelsLike: 5,
    description: 'Regn',
    weatherCode: 61,
    isLoading: false,
    error: null,
    temperatureAvailable: true,
    source: 'gps',
  }),
}));

vi.mock('@/components/WeatherEffects', () => ({
  default: () => <div data-testid="weather-effects" />,
}));

vi.mock('@/components/GpsPrompt', () => ({
  default: () => null,
}));

vi.mock('@/components/JobSeekerDashboardGrid', () => ({
  JobSeekerDashboardGrid: () => <div data-testid="grid" />,
}));

import JobSeekerHome from '@/components/JobSeekerHome';
import { isHomeActivePath } from '@/lib/homeRoute';

function minuteIntervals(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter((call) => Number(call[1]) === 60_000);
}

describe('Home visuella timers är route-scopade', () => {
  let intervalSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    intervalSpy = vi.spyOn(globalThis, 'setInterval');
  });

  afterEach(() => {
    intervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('behandlar /home som Home men aldrig /index', () => {
    expect(isHomeActivePath('/home')).toBe(true);
    expect(isHomeActivePath('/index')).toBe(false);
    expect(isHomeActivePath('/search-jobs')).toBe(false);
  });

  it('startar inga minutintervall och ingen WeatherEffects när Home är dold (/index)', async () => {
    render(
      <MemoryRouter initialEntries={['/index']}>
        <JobSeekerHome />
      </MemoryRouter>,
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    intervalSpy.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
    });

    expect(minuteIntervals(intervalSpy)).toHaveLength(0);
    expect(screen.queryByTestId('weather-effects')).toBeNull();
  });

  it('kör klockor och WeatherEffects när Home är aktiv (/home)', async () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <JobSeekerHome />
      </MemoryRouter>,
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId('weather-effects')).toBeTruthy();

    intervalSpy.mockClear();
    await act(async () => {
      vi.advanceTimersByTime(2 * 60_000);
    });

    expect(minuteIntervals(intervalSpy).length).toBeGreaterThan(0);
  });
});
