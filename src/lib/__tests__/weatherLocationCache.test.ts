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
