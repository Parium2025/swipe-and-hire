import { useEffect, useRef, useState, useCallback } from 'react';

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
  /** How often to refresh weather (not location), default 15 min */
  refreshMs?: number;
}

const DEFAULT_REFRESH_MS = 15 * 60 * 1000;
const LOCATION_CACHE_KEY = 'parium_weather_location';
const LOCATION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const GPS_MAX_AGE = 30 * 60 * 1000; // 30 minutes - reuse GPS for longer

interface CachedLocation {
  lat: number;
  lon: number;
  city: string;
  timestamp: number;
  source: 'gps' | 'ip' | 'fallback';
}

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

// Cache helpers
const getCachedLocation = (): CachedLocation | null => {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedLocation = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    
    // GPS cache is valid longer than IP cache
    const maxAge = data.source === 'gps' ? LOCATION_CACHE_DURATION : LOCATION_CACHE_DURATION / 2;
    if (age > maxAge) {
      localStorage.removeItem(LOCATION_CACHE_KEY);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
};

const setCachedLocation = (location: Omit<CachedLocation, 'timestamp'>) => {
  try {
    const data: CachedLocation = { ...location, timestamp: Date.now() };
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Silent fail
  }
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

// Fallback emoji based on time of day
function getTimeBasedEmoji(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 18) return '👋';
  return '🌙';
}

export const useWeather = (options: UseWeatherOptions = {}): WeatherData => {
  const refreshMs = options.refreshMs ?? DEFAULT_REFRESH_MS;
  const fallbackCity = options.fallbackCity?.trim();

  // Use refs to avoid re-renders and keep stable references
  const locationRef = useRef<CachedLocation | null>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  const [weather, setWeather] = useState<WeatherData>(() => {
    // Initialize with cached data if available for instant display
    const cached = getCachedLocation();
    return {
      temperature: 0,
      weatherCode: 0,
      description: '',
      emoji: getTimeBasedEmoji(),
      city: cached?.city || '',
      isLoading: true,
      error: null,
    };
  });

  const updateWeather = useCallback((data: Partial<WeatherData>) => {
    if (!mountedRef.current) return;
    setWeather(prev => ({ ...prev, ...data }));
  }, []);

  const fetchWeatherOnly = useCallback(async (lat: number, lon: number, city: string) => {
    try {
      const { temperature, weatherCode } = await fetchCurrentWeather(lat, lon);
      const info = getWeatherInfo(weatherCode);
      
      updateWeather({
        temperature,
        weatherCode,
        description: info.description,
        emoji: info.emoji,
        city,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Weather fetch error:', err);
      updateWeather({ isLoading: false, error: 'unavailable' });
    }
  }, [updateWeather]);

  useEffect(() => {
    mountedRef.current = true;
    
    const loadLocation = async () => {
      // Check cache first for instant display
      const cached = getCachedLocation();
      if (cached) {
        locationRef.current = cached;
        // Fetch weather with cached location immediately (no loading state flicker)
        await fetchWeatherOnly(cached.lat, cached.lon, cached.city);
        
        // If we have GPS and cache is from IP, try to upgrade in background
        if (cached.source === 'ip' && navigator.geolocation) {
          // Don't show loading, just try GPS silently
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude: lat, longitude: lon } = position.coords;
              const city = await getCityName(lat, lon);
              const newLocation: CachedLocation = { lat, lon, city, source: 'gps', timestamp: Date.now() };
              setCachedLocation(newLocation);
              locationRef.current = newLocation;
              // Update weather with new location
              await fetchWeatherOnly(lat, lon, city);
            },
            () => {}, // Silent fail - keep using cached
            { timeout: 10000, enableHighAccuracy: false, maximumAge: GPS_MAX_AGE }
          );
        }
        return;
      }

      // No cache - need to get location
      updateWeather({ isLoading: true });

      // Try GPS first
      if (navigator.geolocation) {
        const gpsResult = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
            () => resolve(null),
            { timeout: 8000, enableHighAccuracy: false, maximumAge: GPS_MAX_AGE }
          );
        });

        if (gpsResult && mountedRef.current) {
          const city = await getCityName(gpsResult.lat, gpsResult.lon);
          const location: CachedLocation = { ...gpsResult, city, source: 'gps', timestamp: Date.now() };
          setCachedLocation(location);
          locationRef.current = location;
          await fetchWeatherOnly(gpsResult.lat, gpsResult.lon, city);
          return;
        }
      }

      // Try IP geolocation
      const ipLocation = await getLocationByIP();
      if (ipLocation && mountedRef.current) {
        const location: CachedLocation = { ...ipLocation, source: 'ip', timestamp: Date.now() };
        setCachedLocation(location);
        locationRef.current = location;
        await fetchWeatherOnly(ipLocation.lat, ipLocation.lon, ipLocation.city);
        return;
      }

      // Try fallback city
      if (fallbackCity && mountedRef.current) {
        try {
          const geo = await geocodeCity(fallbackCity);
          const location: CachedLocation = { lat: geo.lat, lon: geo.lon, city: geo.name, source: 'fallback', timestamp: Date.now() };
          setCachedLocation(location);
          locationRef.current = location;
          await fetchWeatherOnly(geo.lat, geo.lon, geo.name);
          return;
        } catch {
          // Fallback city geocoding failed
        }
      }

      // All methods failed
      if (mountedRef.current) {
        updateWeather({ 
          isLoading: false, 
          error: 'unavailable',
          emoji: getTimeBasedEmoji(),
        });
      }
    };

    // Initial load
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadLocation();
    }

    // Refresh weather periodically (not location - that's cached)
    const interval = setInterval(() => {
      if (locationRef.current && mountedRef.current) {
        // Silent refresh - no loading state
        fetchWeatherOnly(
          locationRef.current.lat, 
          locationRef.current.lon, 
          locationRef.current.city
        );
      }
    }, refreshMs);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fallbackCity, refreshMs, fetchWeatherOnly, updateWeather]);

  return weather;
};
