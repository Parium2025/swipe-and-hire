import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCachedWeather,
  setCachedWeather,
  setWeatherCacheUser,
  clearWeatherCache,
} from '@/lib/weatherApi';

/**
 * Spec: the weather DATA cache must be user-bound exactly like the location
 * cache, so a shared device can never show the previous account's reading.
 *
 * Desired key format:  parium_weather_data:v2:<userId>
 * Desired legacy handling: the global key "parium_weather_data" is deleted,
 * never migrated to any account.
 *
 * RED on current code: the cache is still a single global key, so the
 * isolation / no-op / no-migration assertions fail.
 */
const WEATHER_CACHE_PREFIX = 'parium_weather_data:v2:';
const LEGACY_WEATHER_CACHE_KEY = 'parium_weather_data';

const sampleWeather = (city: string) => ({
  temperature: 18,
  feelsLike: 17,
  temperatureAvailable: true,
  weatherCode: 1,
  description: 'Mestadels klart',
  emoji: '🌤️',
  city,
  isNight: false,
  source: 'gps' as const,
});

const weatherKeys = () =>
  Object.keys(localStorage).filter(
    (k) => k.startsWith(WEATHER_CACHE_PREFIX) || k === LEGACY_WEATHER_CACHE_KEY,
  );

describe('weather data cache (user-bound)', () => {
  beforeEach(() => {
    localStorage.clear();
    setWeatherCacheUser(null);
  });

  it('isolates cached weather per user id', () => {
    setWeatherCacheUser('user-a');
    setCachedWeather(sampleWeather('Stockholm'));
    expect(getCachedWeather()?.city).toBe('Stockholm');
    expect(localStorage.getItem(`${WEATHER_CACHE_PREFIX}user-a`)).toBeTruthy();

    setWeatherCacheUser('user-b');
    expect(getCachedWeather()).toBeNull();

    // Switching back restores user A's own reading.
    setWeatherCacheUser('user-a');
    expect(getCachedWeather()?.city).toBe('Stockholm');
  });

  it('is a no-op without a signed-in user', () => {
    setWeatherCacheUser(null);
    setCachedWeather(sampleWeather('Stockholm'));
    expect(weatherKeys()).toHaveLength(0);
    expect(getCachedWeather()).toBeNull();
  });

  it('deletes the legacy global key without migrating it', () => {
    localStorage.setItem(
      LEGACY_WEATHER_CACHE_KEY,
      JSON.stringify({ ...sampleWeather('Helsingborg'), timestamp: Date.now() }),
    );
    setWeatherCacheUser('user-c');

    expect(getCachedWeather()).toBeNull();
    expect(localStorage.getItem(LEGACY_WEATHER_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem(`${WEATHER_CACHE_PREFIX}user-c`)).toBeNull();
  });

  it('clearWeatherCache removes every user-bound weather entry', () => {
    setWeatherCacheUser('user-a');
    setCachedWeather(sampleWeather('A-stad'));
    setWeatherCacheUser('user-b');
    setCachedWeather(sampleWeather('B-stad'));

    clearWeatherCache();

    expect(weatherKeys()).toHaveLength(0);
    setWeatherCacheUser('user-a');
    expect(getCachedWeather()).toBeNull();
  });
});
