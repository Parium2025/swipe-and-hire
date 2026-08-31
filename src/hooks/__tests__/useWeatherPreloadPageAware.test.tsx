import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

/**
 * Spec: the global preload entry points (login, eager preload, background
 * sync) must be page-aware. While a mounted useWeather consumer reports
 * active:false (Home kept alive but hidden under /messages), a separate
 * preloadWeatherLocation() call must not touch the GPS. Once the page is
 * active again a preload may do exactly one coordinated position request.
 *
 * RED on current code: preloadWeatherLocation always resolves a position,
 * even when the only weather consumer is inactive.
 *
 * The real gpsCoordinator/gpsUtils are used so we observe the actual
 * navigator.geolocation.getCurrentPosition calls.
 */

vi.mock('@/hooks/useBackgroundLocation', () => ({
  useBackgroundLocation: () => ({}),
}));

vi.mock('@/lib/weatherApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/weatherApi')>('@/lib/weatherApi');
  return {
    ...actual,
    fetchCurrentWeather: vi.fn(async () => {
      throw new Error('offline in test');
    }),
    getServerSideIPLocation: vi.fn(async () => null),
    getLocationByIP: vi.fn(async () => null),
    geocodeCity: vi.fn(async () => {
      throw new Error('no geocode in test');
    }),
  };
});

import { useWeather, preloadWeatherLocation } from '@/hooks/useWeather';
import { resetGpsCoordinator } from '@/lib/gpsCoordinator';
import { setWeatherCacheUser } from '@/lib/weatherApi';

const accurateFix = {
  coords: { latitude: 59.33, longitude: 18.07, accuracy: 50 },
};

const getCurrentPosition = vi.fn((success: (p: typeof accurateFix) => void) => {
  success(accurateFix);
});
const watchPosition = vi.fn(() => 1);
const clearWatch = vi.fn();

const settle = () => new Promise((r) => setTimeout(r, 20));

describe('preloadWeatherLocation page awareness', () => {
  beforeEach(() => {
    localStorage.clear();
    resetGpsCoordinator();
    setWeatherCacheUser('user-a');
    getCurrentPosition.mockClear();
    watchPosition.mockClear();
    clearWatch.mockClear();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition, watchPosition, clearWatch },
    });
  });

  it('does not call the GPS while the only weather consumer is inactive', async () => {
    const { rerender, unmount } = renderHook(
      ({ active }: { active: boolean }) => useWeather({ enabled: true, active }),
      { initialProps: { active: false } },
    );
    await settle();

    // Home is hidden (KeepAlive) — a background preload must stay silent.
    const resultWhileHidden = await preloadWeatherLocation();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(resultWhileHidden).toBeNull();

    // When the page becomes active again a preload is allowed and must
    // collapse to a single coordinated underlying GPS request.
    rerender({ active: true });
    await waitFor(() => expect(getCurrentPosition.mock.calls.length).toBeGreaterThan(0));

    getCurrentPosition.mockClear();
    const resultWhileActive = await preloadWeatherLocation();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(resultWhileActive?.source).toBe('gps');

    unmount();
  });
});
