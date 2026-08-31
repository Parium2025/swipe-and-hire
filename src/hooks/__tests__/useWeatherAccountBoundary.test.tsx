import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAccuratePosition = vi.fn(async (..._args: unknown[]) => null);

vi.mock('@/lib/gpsUtils', () => ({
  checkGpsPermission: vi.fn(async () => 'granted'),
  getAccuratePosition: (...args: unknown[]) => getAccuratePosition(...args),
  wasLastPositionDenied: vi.fn(() => false),
  isNativeApp: () => false,
  isMobileWeb: () => false,
  COARSE_FIX_ACCURACY_M: 20_000,
  getDistanceKm: () => 0,
}));

vi.mock('@/hooks/useBackgroundLocation', () => ({
  useBackgroundLocation: () => ({}),
}));

const fetchCurrentWeather = vi.fn(async (_lat: number, _lon: number) => ({
  temperature: 14,
  feelsLike: 13,
  temperatureAvailable: true,
  weatherCode: 1,
  isNight: false,
  cachedCity: 'Göteborg',
}));
const getServerSideIPLocation = vi.fn(async () => ({
  lat: 57.71,
  lon: 11.97,
  city: 'Göteborg',
}));

vi.mock('@/lib/weatherApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/weatherApi')>('@/lib/weatherApi');
  return {
    ...actual,
    fetchCurrentWeather: (...args: unknown[]) => fetchCurrentWeather(...(args as [number, number])),
    getServerSideIPLocation: () => getServerSideIPLocation(),
    getLocationByIP: vi.fn(async () => null),
    geocodeCity: vi.fn(async () => {
      throw new Error('not needed');
    }),
  };
});

import { useWeather } from '@/hooks/useWeather';
import {
  resetGpsCoordinator,
  resetPreciseLocationConsent,
} from '@/lib/gpsCoordinator';
import {
  getCachedLocation,
  setCachedLocation,
  setCachedWeather,
  setWeatherCacheUser,
} from '@/lib/weatherApi';

describe('useWeather account-boundary isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    resetGpsCoordinator();
    getAccuratePosition.mockReset();
    fetchCurrentWeather.mockClear();
    getServerSideIPLocation.mockClear();

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
        getCurrentPosition: vi.fn(),
      },
    });
  });

  it('drops the previous owner GPS state even when session consent was already false', async () => {
    setWeatherCacheUser('account-a');
    setCachedLocation({
      lat: 59.3293,
      lon: 18.0686,
      city: 'Stockholm',
      source: 'gps',
    });
    setCachedWeather({
      temperature: 8,
      feelsLike: 7,
      temperatureAvailable: true,
      weatherCode: 2,
      description: 'Halvklart',
      emoji: '⛅',
      city: 'Stockholm',
      isNight: false,
      source: 'gps',
    });

    const { result } = renderHook(() => useWeather({ enabled: true, active: true }));
    expect(result.current).toMatchObject({ city: 'Stockholm', source: 'gps' });

    act(() => {
      // AuthProvider resets precise state synchronously before React binds the
      // weather cache to the next account.
      resetPreciseLocationConsent();
      setWeatherCacheUser('account-b');
    });

    await waitFor(() => expect(result.current).toMatchObject({ city: 'Göteborg', source: 'ip' }));
    expect(getServerSideIPLocation).toHaveBeenCalledTimes(1);
    expect(fetchCurrentWeather).toHaveBeenCalledWith(57.71, 11.97);
    expect(fetchCurrentWeather).not.toHaveBeenCalledWith(59.33, 18.07);
    expect(getCachedLocation()).toMatchObject({ city: 'Göteborg', source: 'ip' });
  });
});
