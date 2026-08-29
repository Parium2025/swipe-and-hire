import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const resolvePosition = vi.fn(async () => null);

vi.mock('@/lib/gpsCoordinator', () => ({
  resolvePosition: () => resolvePosition(),
  notePermissionGranted: vi.fn(),
  isPositionBlocked: () => false,
  resetGpsCoordinator: vi.fn(),
}));

vi.mock('@/hooks/useBackgroundLocation', () => ({
  useBackgroundLocation: () => ({}),
}));

vi.mock('@/lib/weatherApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/weatherApi')>('@/lib/weatherApi');
  return {
    ...actual,
    fetchCurrentWeather: vi.fn(async () => {
      throw new Error('no network in test');
    }),
    getServerSideIPLocation: vi.fn(async () => null),
    getLocationByIP: vi.fn(async () => null),
    geocodeCity: vi.fn(async () => {
      throw new Error('no geocode in test');
    }),
  };
});

import { useWeather } from '@/hooks/useWeather';

const watchPosition = vi.fn(() => 7);
const clearWatch = vi.fn();

describe('useWeather default active behaviour (employer path unchanged)', () => {
  beforeEach(() => {
    localStorage.clear();
    watchPosition.mockClear();
    clearWatch.mockClear();
    resolvePosition.mockClear();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() },
    });
  });

  it('runs fully when no active flag is passed (existing employer/home call shape)', async () => {
    renderHook(() =>
      useWeather({ fallbackCity: 'Stockholm', enabled: true, backgroundLocationEnabled: false }),
    );

    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(resolvePosition).toHaveBeenCalled());
    expect(clearWatch).not.toHaveBeenCalled();
  });

  it('still respects enabled:false', async () => {
    renderHook(() => useWeather({ enabled: false }));
    await new Promise((r) => setTimeout(r, 20));
    expect(watchPosition).not.toHaveBeenCalled();
  });
});
