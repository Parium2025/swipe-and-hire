import { describe, it, expect, beforeEach } from 'vitest';
import {
  setWeatherCacheUser,
  getCachedWeather,
  getStaleCachedWeather,
  WEATHER_CACHE_PREFIX,
  type CachedWeather,
} from '@/lib/weatherApi';

const USER = 'user-a';
const keyFor = (userId: string) => `${WEATHER_CACHE_PREFIX}${userId}`;

const makeEntry = (ageMs: number): CachedWeather => ({
  temperature: 12,
  feelsLike: 10,
  temperatureAvailable: true,
  weatherCode: 1,
  description: 'Mestadels klart',
  emoji: '🌤️',
  city: 'Stockholm',
  isNight: false,
  source: 'gps',
  timestamp: Date.now() - ageMs,
});

describe('weather stale fallback survival (offline path)', () => {
  beforeEach(() => {
    localStorage.clear();
    setWeatherCacheUser(USER);
  });

  it('keeps a 6-minute-old GPS entry stored after the fresh read so the stale read can still return it', () => {
    const entry = makeEntry(6 * 60 * 1000); // 6 min: past 5-min fresh TTL, well within 24h stale TTL
    localStorage.setItem(keyFor(USER), JSON.stringify(entry));

    // Fresh read must say "expired"...
    expect(getCachedWeather()).toBeNull();

    // ...but must NOT destroy the entry — the offline stale fallback depends on it.
    expect(localStorage.getItem(keyFor(USER))).not.toBeNull();
    const stale = getStaleCachedWeather();
    expect(stale).not.toBeNull();
    expect(stale?.city).toBe('Stockholm');
    expect(stale?.temperature).toBe(12);
    expect(stale?.source).toBe('gps');
  });

  it('returns null from the stale read for entries older than 24 hours and removes the user key', () => {
    const entry = makeEntry(25 * 60 * 60 * 1000);
    localStorage.setItem(keyFor(USER), JSON.stringify(entry));

    expect(getStaleCachedWeather()).toBeNull();
    expect(localStorage.getItem(keyFor(USER))).toBeNull();
  });

  it('removes corrupt JSON from the user key', () => {
    localStorage.setItem(keyFor(USER), '{not valid json');

    expect(getStaleCachedWeather()).toBeNull();
    expect(localStorage.getItem(keyFor(USER))).toBeNull();
  });
});
