import { describe, it, expect } from 'vitest';
import { parseWeatherResponse, hasConfirmedWeather } from '../weatherApi';

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
  it('returns true only when both city and temperatureAvailable are set', () => {
    expect(hasConfirmedWeather({ city: 'Stockholm', temperatureAvailable: true })).toBe(true);
    expect(hasConfirmedWeather({ city: 'Stockholm', temperatureAvailable: false })).toBe(false);
    expect(hasConfirmedWeather({ city: '', temperatureAvailable: true })).toBe(false);
    expect(hasConfirmedWeather(null)).toBe(false);
    expect(hasConfirmedWeather(undefined)).toBe(false);
  });
});
