import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseWeatherResponse, hasConfirmedWeather, setCachedWeather, getCachedWeather, getStaleCachedWeather, setWeatherCacheUser } from '../weatherApi';

// ─── Mock localStorage ──────────────────────────────────────────────
const localStorageMap = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageMap.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageMap.set(key, value); }),
  removeItem: vi.fn((key: string) => { localStorageMap.delete(key); }),
  clear: vi.fn(() => localStorageMap.clear()),
  get length() { return localStorageMap.size; },
  key: vi.fn((i: number) => [...localStorageMap.keys()][i] ?? null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

const makeResponse = (overrides: Record<string, unknown> = {}) => ({
  current: {
    time: '2026-05-28T12:00',
    temperature_2m: 18.4,
    apparent_temperature: 17.2,
    weather_code: 1,
  },
  daily: {
    time: ['2026-05-28'],
    sunrise: ['2026-05-28T05:00'],
    sunset: ['2026-05-28T21:00'],
  },
  ...overrides,
});

describe('parseWeatherResponse', () => {
  it('marks temperature available for a valid response', () => {
    const r = parseWeatherResponse(makeResponse());
    expect(r.temperatureAvailable).toBe(true);
    expect(r.temperature).toBe(18);
    expect(r.feelsLike).toBe(17);
    expect(r.weatherCode).toBe(1);
    expect(r.isNight).toBe(false);
  });

  it('marks temperature unavailable when response is the neutral fallback', () => {
    const r = parseWeatherResponse(makeResponse({ fallback: true }));
    expect(r.temperatureAvailable).toBe(false);
    expect(r.temperature).toBe(0);
    expect(r.feelsLike).toBe(0);
  });

  it('marks temperature unavailable for non-numeric / NaN values', () => {
    const r = parseWeatherResponse(
      makeResponse({ current: { time: '2026-05-28T12:00', temperature_2m: null, apparent_temperature: 17, weather_code: 1 } })
    );
    expect(r.temperatureAvailable).toBe(false);

    const r2 = parseWeatherResponse(
      makeResponse({ current: { time: '2026-05-28T12:00', temperature_2m: NaN, apparent_temperature: NaN, weather_code: 1 } })
    );
    expect(r2.temperatureAvailable).toBe(false);
  });

  it('detects night when current time is outside sunrise/sunset', () => {
    const r = parseWeatherResponse(
      makeResponse({ current: { time: '2026-05-28T23:30', temperature_2m: 8, apparent_temperature: 7, weather_code: 0 } })
    );
    expect(r.isNight).toBe(true);
  });

  it('throws when current block is missing', () => {
    expect(() => parseWeatherResponse({} as Record<string, unknown>)).toThrow();
  });
});

describe('hasConfirmedWeather', () => {
  it('returns true only for GPS-sourced weather with a city and real temperature', () => {
    expect(hasConfirmedWeather({ city: 'Stockholm', temperatureAvailable: true, source: 'gps' })).toBe(true);
    expect(hasConfirmedWeather({ city: 'Stockholm', temperatureAvailable: true, source: 'ip' })).toBe(false);
    expect(hasConfirmedWeather({ city: 'Stockholm', temperatureAvailable: true, source: 'fallback' })).toBe(false);
    expect(hasConfirmedWeather({ city: 'Stockholm', temperatureAvailable: false, source: 'gps' })).toBe(false);
    expect(hasConfirmedWeather({ city: '', temperatureAvailable: true, source: 'gps' })).toBe(false);
    expect(hasConfirmedWeather({ city: 'Stockholm', temperatureAvailable: true })).toBe(false);
    expect(hasConfirmedWeather(null)).toBe(false);
    expect(hasConfirmedWeather(undefined)).toBe(false);
  });
});

describe('weather cache helpers', () => {
  // The weather cache is user-bound (parium_weather_data:v2:<userId>); the old
  // global key is never read.
  const KEY = 'parium_weather_data:v2:user-a';

  beforeEach(() => {
    localStorage.clear();
    setWeatherCacheUser('user-a');
  });

  const sample = {
    temperature: 18,
    feelsLike: 17,
    temperatureAvailable: true,
    weatherCode: 1,
    description: 'Mestadels klart',
    emoji: '🌤️',
    city: 'Stockholm',
    isNight: false,
  };

  it('getCachedWeather returns fresh cache and ignores expired cache', () => {
    setCachedWeather(sample);
    expect(getCachedWeather()?.city).toBe('Stockholm');

    // Simulate 6 minutes passing (TTL is 5 minutes)
    const stale = { ...sample, timestamp: Date.now() - 6 * 60 * 1000 };
    localStorage.setItem(KEY, JSON.stringify(stale));
    expect(getCachedWeather()).toBeNull();
  });

  it('getStaleCachedWeather accepts older entries up to 24 hours', () => {
    const stale = { ...sample, timestamp: Date.now() - 6 * 60 * 1000 };
    localStorage.setItem(KEY, JSON.stringify(stale));
    expect(getStaleCachedWeather()?.city).toBe('Stockholm');

    const ancient = { ...sample, timestamp: Date.now() - 25 * 60 * 60 * 1000 };
    localStorage.setItem(KEY, JSON.stringify(ancient));
    expect(getStaleCachedWeather()).toBeNull();
  });
});
