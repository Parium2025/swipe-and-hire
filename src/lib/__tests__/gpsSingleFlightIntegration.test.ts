import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/weatherApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/weatherApi')>('@/lib/weatherApi');
  return {
    ...actual,
    fetchCurrentWeather: vi.fn(async () => {
      throw new Error('no network in test');
    }),
    getServerSideIPLocation: vi.fn(async () => null),
    getLocationByIP: vi.fn(async () => null),
  };
});

import { preloadWeatherLocation } from '@/hooks/useWeather';
import { notePermissionGranted, resetGpsCoordinator, resolvePosition } from '@/lib/gpsCoordinator';
import { setWeatherCacheUser } from '@/lib/weatherApi';

const getCurrentPosition = vi.fn();

describe('GPS single-flight across preload + hook path', () => {
  beforeEach(() => {
    localStorage.clear();
    resetGpsCoordinator();
    // These tests cover single-flight/denial after the user has opted in.
    notePermissionGranted();
    setWeatherCacheUser('user-single-flight');
    getCurrentPosition.mockReset();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition, watchPosition: vi.fn(), clearWatch: vi.fn() },
    });
  });

  it('collapses concurrent preload + resolvePosition into one geolocation call', async () => {
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      setTimeout(
        () => success({ coords: { latitude: 59.33, longitude: 18.06, accuracy: 25 } } as GeolocationPosition),
        5,
      );
    });

    await Promise.all([preloadWeatherLocation(), preloadWeatherLocation(), resolvePosition()]);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('does not retry with high accuracy after PERMISSION_DENIED', async () => {
    getCurrentPosition.mockImplementation((_s: PositionCallback, error: PositionErrorCallback) => {
      setTimeout(() => error({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError), 1);
    });

    const fix = await resolvePosition();

    expect(fix).toBeNull();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('keeps login preload off exact GPS after reload even when OS permission is granted', async () => {
    resetGpsCoordinator();
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'granted' }),
      },
    });
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 59.33, longitude: 18.06, accuracy: 25 } } as GeolocationPosition);
    });

    await preloadWeatherLocation();

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
