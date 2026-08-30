/**
 * RED → GREEN: preloadWeatherLocation skriver i den kontoskopade väder-/plats-
 * cachen EFTER await:ade GPS-/IP-/väderanrop. Om konto A startar hämtningen och
 * konto B blir aktuellt innan svaret landar, hamnar A:s plats och väder i B:s
 * cache.
 *
 * Kontraktet: en valfri (bakåtkompatibel) `isCurrent`-vakt kontrolleras före
 * VARJE cache-skrivning och efter varje kontobundet await. Anropare utan vakt
 * behåller nuvarande beteende.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}
const makeDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const h = vi.hoisted(() => ({
  gps: null as Deferred<{ lat: number; lon: number } | null> | null,
  weather: null as Deferred<unknown> | null,
  serverIp: null as Deferred<{ lat: number; lon: number; city?: string } | null> | null,
  cachedLocation: null as { lat: number; lon: number; city: string; source: string; timestamp: number } | null,
  cachedWeather: null as { temperature: number; timestamp: number } | null,
  setLocation: vi.fn(),
  setWeather: vi.fn(),
  ipFallbackCalled: vi.fn(() => Promise.resolve(null as { lat: number; lon: number } | null)),
}));

vi.mock('@/hooks/useBackgroundLocation', () => ({ useBackgroundLocation: () => ({}) }));

vi.mock('@/lib/gpsCoordinator', () => ({
  resolvePosition: async () => (h.gps ? await h.gps.promise : null),
  resetGpsCoordinator: () => {},
}));

vi.mock('@/lib/weatherApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/weatherApi')>('@/lib/weatherApi');
  return {
    ...actual,
    getCachedLocation: () => h.cachedLocation,
    getCachedWeather: () => h.cachedWeather,
    setCachedLocation: (...args: unknown[]) => h.setLocation(...args),
    setCachedWeather: (...args: unknown[]) => h.setWeather(...args),
    getServerSideIPLocation: async () => (h.serverIp ? await h.serverIp.promise : null),
    getLocationByIP: () => h.ipFallbackCalled(),
    fetchCurrentWeather: async () => {
      if (h.weather) await h.weather.promise;
      return {
        temperature: 5,
        feelsLike: 4,
        temperatureAvailable: true,
        weatherCode: 0,
        isNight: false,
        cachedCity: 'Stockholm',
      };
    },
  };
});

import { preloadWeatherLocation } from '@/hooks/useWeather';

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('preloadWeatherLocation — kontovakt före cache-skrivningar', () => {
  beforeEach(() => {
    localStorage.clear();
    h.gps = null;
    h.weather = null;
    h.setLocation.mockClear();
    h.setWeather.mockClear();
  });

  it('A:s plats/väder skrivs inte när ägaren bytts innan GPS-svaret landar', async () => {
    let current = 'A';
    h.gps = makeDeferred<{ lat: number; lon: number } | null>();

    const run = preloadWeatherLocation({ isCurrent: () => current === 'A' });
    await tick();

    current = 'B'; // kontobyte medan GPS är i flykt
    h.gps.resolve({ lat: 59.33, lon: 18.07 });
    await run;
    await tick();

    expect(h.setLocation).not.toHaveBeenCalled();
    expect(h.setWeather).not.toHaveBeenCalled();
  });

  it('vädersvaret skrivs inte när ägaren bytts under väderhämtningen', async () => {
    let current = 'A';
    h.gps = makeDeferred<{ lat: number; lon: number } | null>();
    h.weather = makeDeferred<unknown>();

    const run = preloadWeatherLocation({ isCurrent: () => current === 'A' });
    await tick();
    h.gps.resolve({ lat: 59.33, lon: 18.07 });
    await tick();

    expect(h.setLocation).toHaveBeenCalledTimes(1); // ägaren var fortfarande aktuell

    current = 'B';
    h.weather.resolve(null);
    await run;
    await tick();

    expect(h.setWeather).not.toHaveBeenCalled();
  });

  it('aktuell ägare skriver som vanligt', async () => {
    h.gps = makeDeferred<{ lat: number; lon: number } | null>();
    const run = preloadWeatherLocation({ isCurrent: () => true });
    h.gps.resolve({ lat: 59.33, lon: 18.07 });
    await run;

    expect(h.setLocation).toHaveBeenCalled();
    expect(h.setWeather).toHaveBeenCalledTimes(1);
  });

  it('anropare utan vakt behåller nuvarande beteende', async () => {
    h.gps = makeDeferred<{ lat: number; lon: number } | null>();
    const run = preloadWeatherLocation();
    h.gps.resolve({ lat: 59.33, lon: 18.07 });
    await run;

    expect(h.setLocation).toHaveBeenCalled();
    expect(h.setWeather).toHaveBeenCalledTimes(1);
  });
});
