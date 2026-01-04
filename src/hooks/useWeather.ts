import { useEffect, useRef, useState } from 'react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  description: string;
  emoji: string;
  city: string;
  isLoading: boolean;
  error: string | null;
}

interface UseWeatherOptions {
  /** Used when all location methods fail */
  fallbackCity?: string;
  /** How often to refresh, without re-requesting geolocation permission */
  refreshMs?: number;
}

const DEFAULT_REFRESH_MS = 15 * 60 * 1000;

// Weather codes from Open-Meteo API
const getWeatherInfo = (code: number): { description: string; emoji: string } => {
  if (code === 0) return { description: 'klart', emoji: '☀️' };
  if (code === 1) return { description: 'mestadels klart', emoji: '🌤️' };
  if (code === 2) return { description: 'halvklart', emoji: '⛅' };
  if (code === 3) return { description: 'molnigt', emoji: '☁️' };
  if (code === 45 || code === 48) return { description: 'dimma', emoji: '🌫️' };
  if (code >= 51 && code <= 57) return { description: 'duggregn', emoji: '🌧️' };
  if (code >= 61 && code <= 67) return { description: 'regn', emoji: '🌧️' };
  if (code >= 71 && code <= 77) return { description: 'snö', emoji: '❄️' };
  if (code >= 80 && code <= 82) return { description: 'regnskurar', emoji: '🌦️' };
  if (code >= 85 && code <= 86) return { description: 'snöbyar', emoji: '🌨️' };
  if (code >= 95 && code <= 99) return { description: 'åska', emoji: '⛈️' };
  return { description: 'okänt', emoji: '🌡️' };
};

const fetchCurrentWeather = async (lat: number, lon: number) => {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
  );
  const data = await res.json();
  const current = data?.current_weather;
  if (!current) throw new Error('Missing current_weather');
  return {
    temperature: Math.round(current.temperature),
    weatherCode: current.weathercode as number,
  };
};

// Reverse geocoding to get city name
const getCityName = async (lat: number, lon: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=sv`
    );
    const data = await response.json();

    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.municipality ||
      data.address?.village ||
      data.address?.suburb ||
      data.address?.county ||
      '';

    return city;
  } catch {
    return '';
  }
};

// IP-based geolocation (no permission required, less accurate)
const getLocationByIP = async (): Promise<{ lat: number; lon: number; city: string } | null> => {
  // Try multiple IP geolocation services for redundancy (all HTTPS)
  const services = [
    async () => {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      if (data.latitude && data.longitude) {
        return { lat: data.latitude, lon: data.longitude, city: data.city || '' };
      }
      return null;
    },
    async () => {
      const response = await fetch('https://ipwho.is/');
      const data = await response.json();
      if (data.success && data.latitude && data.longitude) {
        return { lat: data.latitude, lon: data.longitude, city: data.city || '' };
      }
      return null;
    },
    async () => {
      const response = await fetch('https://freeipapi.com/api/json');
      const data = await response.json();
      if (data.latitude && data.longitude) {
        return { lat: data.latitude, lon: data.longitude, city: data.cityName || '' };
      }
      return null;
    },
  ];

  for (const service of services) {
    try {
      const result = await service();
      if (result) return result;
    } catch {
      // Try next service
    }
  }
  return null;
};

const geocodeCity = async (city: string): Promise<{ lat: number; lon: number; name: string }> => {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=sv&format=json`
  );
  const data = await res.json();
  const best = data?.results?.[0];
  if (!best) throw new Error('No geocoding result');
  return {
    lat: best.latitude,
    lon: best.longitude,
    name: best.name ?? city,
  };
};

export const useWeather = (options: UseWeatherOptions = {}): WeatherData => {
  const refreshMs = options.refreshMs ?? DEFAULT_REFRESH_MS;
  const fallbackCity = options.fallbackCity?.trim();

  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const cityRef = useRef<string>('');

  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    weatherCode: 0,
    description: '',
    emoji: getTimeBasedEmoji(),
    city: '',
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const applyWeather = (payload: { temperature: number; weatherCode: number; city: string }) => {
      const info = getWeatherInfo(payload.weatherCode);
      cityRef.current = payload.city;
      setWeather({
        temperature: payload.temperature,
        weatherCode: payload.weatherCode,
        description: info.description,
        emoji: info.emoji,
        city: payload.city,
        isLoading: false,
        error: null,
      });
    };

    const fail = () => {
      setWeather({
        temperature: 0,
        weatherCode: 0,
        description: '',
        emoji: getTimeBasedEmoji(),
        city: '',
        isLoading: false,
        error: 'unavailable',
      });
    };

    const fetchByCoords = async (lat: number, lon: number, knownCity?: string) => {
      const [{ temperature, weatherCode }, city] = await Promise.all([
        fetchCurrentWeather(lat, lon),
        knownCity ? Promise.resolve(knownCity) : getCityName(lat, lon),
      ]);
      coordsRef.current = { lat, lon };
      applyWeather({ temperature, weatherCode, city });
    };

    const fetchByCity = async (city: string) => {
      const geo = await geocodeCity(city);
      const { temperature, weatherCode } = await fetchCurrentWeather(geo.lat, geo.lon);
      coordsRef.current = { lat: geo.lat, lon: geo.lon };
      applyWeather({ temperature, weatherCode, city: geo.name });
    };

    const load = async ({ cacheOnly }: { cacheOnly?: boolean } = {}) => {
      if (!cacheOnly) {
        setWeather(prev => ({ ...prev, isLoading: true, error: null }));
      }

      try {
        // If we already have coords from a previous successful fetch, just refresh weather
        if (coordsRef.current) {
          await fetchByCoords(coordsRef.current.lat, coordsRef.current.lon, cityRef.current);
          return;
        }

        // Try GPS geolocation first (will prompt for permission only if not already granted)
        if (!cacheOnly && navigator.geolocation) {
          const gpsResult = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
              () => resolve(null), // Permission denied or error - silent fail
              { timeout: 5000, enableHighAccuracy: false, maximumAge: 10 * 60 * 1000 }
            );
          });

          if (gpsResult && !cancelled) {
            await fetchByCoords(gpsResult.lat, gpsResult.lon);
            return;
          }
        }

        // Fallback: IP-based geolocation (no permission required)
        if (!cacheOnly) {
          const ipLocation = await getLocationByIP();
          if (ipLocation && !cancelled) {
            await fetchByCoords(ipLocation.lat, ipLocation.lon, ipLocation.city);
            return;
          }
        }

        // Fallback: use configured fallback city
        if (fallbackCity) {
          await fetchByCity(fallbackCity);
          return;
        }

        // All methods failed
        throw new Error('No location available');
      } catch (err) {
        if (cancelled) return;
        console.error('Weather load error:', err);
        fail();
      }
    };

    void load();

    const interval = window.setInterval(() => {
      if (cancelled) return;
      void load({ cacheOnly: true });
    }, refreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fallbackCity, refreshMs]);

  return weather;
};

// Fallback emoji based on time of day
function getTimeBasedEmoji(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 18) return '👋';
  return '🌙';
}
