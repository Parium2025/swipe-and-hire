import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCachedLocation,
  setCachedLocation,
  setWeatherCacheUser,
  LOCATION_CACHE_PREFIX,
  LEGACY_LOCATION_CACHE_KEY,
} from '@/lib/weatherApi';

describe('weather location cache (user-bound)', () => {
  beforeEach(() => {
    localStorage.clear();
    setWeatherCacheUser(null);
  });

  it('isolates cached position per user id', () => {
    setWeatherCacheUser('user-a');
    setCachedLocation({ lat: 59.3, lon: 18.1, city: 'Stockholm', source: 'gps' });
    expect(getCachedLocation()?.city).toBe('Stockholm');
    expect(localStorage.getItem(`${LOCATION_CACHE_PREFIX}user-a`)).toBeTruthy();

    setWeatherCacheUser('user-b');
    expect(getCachedLocation()).toBeNull();
  });

  it('persists only a coarse weather grid, never the exact GPS coordinates', () => {
    setWeatherCacheUser('user-private-location');
    setCachedLocation({
      lat: 59.329323499,
      lon: 18.068580812,
      city: 'Stockholm',
      source: 'gps',
    });

    const raw = localStorage.getItem(`${LOCATION_CACHE_PREFIX}user-private-location`);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw as string) as { lat: number; lon: number };

    expect(stored.lat).toBe(59.33);
    expect(stored.lon).toBe(18.07);
    expect(stored.lat).not.toBe(59.329323499);
    expect(stored.lon).not.toBe(18.068580812);
  });

  it('coarsens an exact legacy GPS cache entry the first time it is read', () => {
    const key = `${LOCATION_CACHE_PREFIX}user-existing-location`;
    localStorage.setItem(key, JSON.stringify({
      lat: 59.329323499,
      lon: 18.068580812,
      city: 'Stockholm',
      source: 'gps',
      timestamp: Date.now(),
    }));
    setWeatherCacheUser('user-existing-location');

    expect(getCachedLocation()).toMatchObject({ lat: 59.33, lon: 18.07 });
    expect(JSON.parse(localStorage.getItem(key) as string)).toMatchObject({
      lat: 59.33,
      lon: 18.07,
    });
  });

  it('deletes an expired exact GPS cache instead of leaving it persisted', () => {
    const key = `${LOCATION_CACHE_PREFIX}user-expired-location`;
    localStorage.setItem(key, JSON.stringify({
      lat: 59.329323499,
      lon: 18.068580812,
      city: 'Stockholm',
      source: 'gps',
      timestamp: Date.now() - 10 * 60 * 1000,
    }));
    setWeatherCacheUser('user-expired-location');

    expect(getCachedLocation()).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('is a no-op without a signed-in user', () => {
    setCachedLocation({ lat: 1, lon: 2, city: 'X', source: 'gps' });
    const written = Object.keys(localStorage).filter((k) => k.startsWith(LOCATION_CACHE_PREFIX));
    expect(written).toHaveLength(0);
    expect(getCachedLocation()).toBeNull();
  });

  it('deletes the legacy global key without migrating it', () => {
    localStorage.setItem(
      LEGACY_LOCATION_CACHE_KEY,
      JSON.stringify({ lat: 56, lon: 12.7, city: 'Helsingborg', source: 'ip', timestamp: Date.now() }),
    );
    setWeatherCacheUser('user-c');

    expect(getCachedLocation()).toBeNull();
    expect(localStorage.getItem(LEGACY_LOCATION_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem(`${LOCATION_CACHE_PREFIX}user-c`)).toBeNull();
  });

  it('drops corrupt cache entries', () => {
    setWeatherCacheUser('user-d');
    localStorage.setItem(`${LOCATION_CACHE_PREFIX}user-d`, 'not-json');
    expect(getCachedLocation()).toBeNull();
    expect(localStorage.getItem(`${LOCATION_CACHE_PREFIX}user-d`)).toBeNull();
  });
});
