/**
 * RED → GREEN: Home:s normala cache-läsare får aldrig returnera poster med
 * framtida tidsstämplar (korrupt/manipulerad klocka). Sådana poster ska
 * dessutom tas bort så att de inte överlever en omladdning.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setWeatherCacheUser,
  getCachedLocation,
  getCachedWeather,
  getStaleCachedWeather,
  LOCATION_CACHE_PREFIX,
  WEATHER_CACHE_PREFIX,
} from '@/lib/weatherApi';

const USER = 'user-a';
const locKey = `${LOCATION_CACHE_PREFIX}${USER}`;
const weaKey = `${WEATHER_CACHE_PREFIX}${USER}`;

const writeLocation = (timestamp: number) =>
  localStorage.setItem(
    locKey,
    JSON.stringify({ lat: 59.33, lon: 18.07, city: 'Stockholm', source: 'gps', timestamp }),
  );

const writeWeather = (timestamp: number) =>
  localStorage.setItem(
    weaKey,
    JSON.stringify({
      temperature: 5,
      feelsLike: 4,
      temperatureAvailable: true,
      weatherCode: 0,
      description: 'Klart',
      emoji: '☀️',
      city: 'Stockholm',
      isNight: false,
      source: 'gps',
      timestamp,
    }),
  );

describe('weatherApi cache-läsare — framtida tidsstämplar', () => {
  beforeEach(() => {
    localStorage.clear();
    setWeatherCacheUser(USER);
  });

  it('returnerar giltig, aktuell cache', () => {
    writeLocation(Date.now() - 1000);
    writeWeather(Date.now() - 1000);
    expect(getCachedLocation()?.city).toBe('Stockholm');
    expect(getCachedWeather()?.temperature).toBe(5);
  });

  it('normalt utgången cache returneras inte men färsk läsning raderar den inte', () => {
    writeLocation(Date.now() - 10 * 60 * 1000);
    writeWeather(Date.now() - 10 * 60 * 1000);
    expect(getCachedLocation()).toBeNull();
    expect(getCachedWeather()).toBeNull();
    // Offline-fallbacken måste fortfarande kunna använda posten
    expect(localStorage.getItem(weaKey)).not.toBeNull();
    expect(getStaleCachedWeather()?.temperature).toBe(5);
  });

  it('framtida platscache returneras inte och tas bort', () => {
    writeLocation(Date.now() + 60_000);
    expect(getCachedLocation()).toBeNull();
    expect(localStorage.getItem(locKey)).toBeNull();
  });

  it('framtida väder returneras inte av den färska läsningen och tas bort', () => {
    writeWeather(Date.now() + 60_000);
    expect(getCachedWeather()).toBeNull();
    expect(localStorage.getItem(weaKey)).toBeNull();
  });

  it('framtida väder returneras inte heller av offline-fallbacken och tas bort', () => {
    writeWeather(Date.now() + 60_000);
    expect(getStaleCachedWeather()).toBeNull();
    expect(localStorage.getItem(weaKey)).toBeNull();
  });
});
