import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

let precisePermissionGranted = false;
let permissionGrantedListener: ((allowed: boolean) => void) | null = null;
const notePermissionRevoked = vi.fn(() => {
  precisePermissionGranted = false;
  permissionGrantedListener?.(false);
});

const canUsePreciseLocation = vi.fn(async () => precisePermissionGranted);
const resolvePosition = vi.fn(async () => ({
  lat: 59.329323499,
  lon: 18.068580812,
  accuracy: 12,
}));

vi.mock('@/lib/gpsCoordinator', () => ({
  canUsePreciseLocation: () => canUsePreciseLocation(),
  resolvePosition: () => resolvePosition(),
  subscribeToPreciseLocationPermission: (listener: (allowed: boolean) => void) => {
    permissionGrantedListener = listener;
    return () => {
      if (permissionGrantedListener === listener) permissionGrantedListener = null;
    };
  },
  notePermissionRevoked: () => notePermissionRevoked(),
}));

vi.mock('@/lib/gpsUtils', () => ({
  isNativeApp: () => false,
  isMobileWeb: () => false,
  COARSE_FIX_ACCURACY_M: 20_000,
  getDistanceKm: () => 0,
}));

vi.mock('@/hooks/useBackgroundLocation', () => ({
  useBackgroundLocation: () => ({}),
}));

const fetchCurrentWeather = vi.fn(async (_lat: number, _lon: number) => ({
  temperature: 12,
  feelsLike: 11,
  temperatureAvailable: true,
  weatherCode: 1,
  isNight: false,
  cachedCity: 'Stockholm',
}));
const getServerSideIPLocation = vi.fn(async () => ({
  lat: 59.3,
  lon: 18.1,
  city: 'Stockholm',
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
import { setWeatherCacheUser } from '@/lib/weatherApi';

let watchError: PositionErrorCallback | null = null;
let watchSuccess: PositionCallback | null = null;
const watchPosition = vi.fn((onSuccess: PositionCallback, onError: PositionErrorCallback) => {
  watchSuccess = onSuccess;
  watchError = onError;
  return 9;
});
const clearWatch = vi.fn();

describe('useWeather precise-location consent', () => {
  beforeEach(() => {
    localStorage.clear();
    setWeatherCacheUser('weather-consent-user');
    precisePermissionGranted = false;
    permissionGrantedListener = null;
    watchSuccess = null;
    watchError = null;
    canUsePreciseLocation.mockClear();
    resolvePosition.mockClear();
    fetchCurrentWeather.mockClear();
    getServerSideIPLocation.mockClear();
    watchPosition.mockClear();
    clearWatch.mockClear();
    notePermissionRevoked.mockClear();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() },
    });
  });

  it('uses IP weather but neither resolves nor watches precise GPS before opt-in', async () => {
    const { result } = renderHook(() => useWeather({ enabled: true, active: true }));

    await waitFor(() => expect(getServerSideIPLocation).toHaveBeenCalled());
    await waitFor(() => expect(result.current.city).toBe('Stockholm'));

    expect(resolvePosition).not.toHaveBeenCalled();
    expect(watchPosition).not.toHaveBeenCalled();
    expect(result.current.source).toBe('ip');
  });

  it('starts precise resolution and the watcher immediately after deliberate opt-in', async () => {
    renderHook(() => useWeather({ enabled: true, active: true }));
    await waitFor(() => expect(getServerSideIPLocation).toHaveBeenCalled());

    precisePermissionGranted = true;
    expect(permissionGrantedListener).toBeTypeOf('function');
    act(() => permissionGrantedListener?.(true));

    await waitFor(() => expect(resolvePosition).toHaveBeenCalled());
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));
  });

  it('drops exact in-memory coordinates, stops watcher and switches to IP after revocation', async () => {
    renderHook(() => useWeather({ enabled: true, active: true }));
    await waitFor(() => expect(getServerSideIPLocation).toHaveBeenCalledTimes(1));

    precisePermissionGranted = true;
    act(() => permissionGrantedListener?.(true));
    await waitFor(() => expect(resolvePosition).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchCurrentWeather).toHaveBeenCalledWith(59.329323499, 18.068580812));

    act(() => watchError?.({ code: 1, message: 'permission denied' } as GeolocationPositionError));

    await waitFor(() => expect(notePermissionRevoked).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(clearWatch).toHaveBeenCalledWith(9));
    await waitFor(() => expect(getServerSideIPLocation).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fetchCurrentWeather).toHaveBeenLastCalledWith(59.3, 18.1));

    const weatherCallsAfterFallback = fetchCurrentWeather.mock.calls.length;
    act(() => {
      void watchSuccess?.({
        coords: {
          latitude: 57.7089,
          longitude: 11.9746,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchCurrentWeather).toHaveBeenCalledTimes(weatherCallsAfterFallback);
    expect(fetchCurrentWeather).not.toHaveBeenCalledWith(57.7089, 11.9746);
  });

  it.each([2, 3])('keeps watcher consent on transient geolocation error code %s', async (code) => {
    precisePermissionGranted = true;
    renderHook(() => useWeather({ enabled: true, active: true }));
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));

    act(() => watchError?.({ code, message: 'transient location error' } as GeolocationPositionError));

    expect(notePermissionRevoked).not.toHaveBeenCalled();
    expect(clearWatch).not.toHaveBeenCalled();
  });
});
