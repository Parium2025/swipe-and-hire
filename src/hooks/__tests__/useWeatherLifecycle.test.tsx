import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const resolvePosition = vi.fn(async () => null);

vi.mock('@/lib/gpsCoordinator', () => ({
  resolvePosition: (...args: unknown[]) => resolvePosition(...args),
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
      throw new Error('offline in test');
    }),
    getServerSideIPLocation: vi.fn(async () => null),
    getLocationByIP: vi.fn(async () => null),
    geocodeCity: vi.fn(async () => {
      throw new Error('no geocode in test');
    }),
  };
});

import { useWeather } from '@/hooks/useWeather';

const watchPosition = vi.fn(() => 1);
const clearWatch = vi.fn();

describe('useWeather lifecycle (active flag)', () => {
  beforeEach(() => {
    localStorage.clear();
    resolvePosition.mockClear();
    watchPosition.mockClear();
    clearWatch.mockClear();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts no watcher and no GPS work when inactive', async () => {
    renderHook(() => useWeather({ enabled: true, active: false }));
    await new Promise((r) => setTimeout(r, 20));
    expect(watchPosition).not.toHaveBeenCalled();
    expect(resolvePosition).not.toHaveBeenCalled();
  });

  it('starts a watcher when active and clears it when it goes inactive', async () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useWeather({ enabled: true, active }),
      { initialProps: { active: true } },
    );

    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));

    rerender({ active: false });
    await waitFor(() => expect(clearWatch).toHaveBeenCalledTimes(1));

    rerender({ active: true });
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(2));
    expect(clearWatch).toHaveBeenCalledTimes(1);
  });
});
