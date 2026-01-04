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

interface CachedLocation {
  lat: number;
  lon: number;
  city: string;
  timestamp: number;
  source: 'gps' | 'ip' | 'fallback';
}

interface UseWeatherOptions {
  /** Used when all location methods fail */
  fallbackCity?: string;
  /** How often to refresh weather, default 15 min */
  refreshMs?: number;
}

const DEFAULT_REFRESH_MS = 15 * 60 * 1000;
const LOCATION_CACHE_KEY = 'parium_weather_location';
const WEATHER_CACHE_KEY = 'parium_weather_data';
const MOVEMENT_THRESHOLD_KM = 10; // If moved more than 10km, update location

interface CachedWeather {
  temperature: number;
  weatherCode: number;
  description: string;
  emoji: string;
  city: string;
  timestamp: number;
}

interface CachedLocation {
  lat: number;
  lon: number;
  city: string;
  timestamp: number;
  source: 'gps' | 'ip' | 'fallback';
}

// Calculate distance between two coordinates in km (Haversine formula)
const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Check if it's nighttime (between 21:00 and 06:00)
const isNightTime = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 21 || hour < 6;
};

// Weather codes from Open-Meteo API
const getWeatherInfo = (code: number): { description: string; emoji: string } => {
  const night = isNightTime();
  
  if (code === 0) return { description: 'Klart', emoji: night ? '🌙' : '☀️' };
  if (code === 1) return { description: 'Mestadels klart', emoji: night ? '🌙' : '🌤️' };
  if (code === 2) return { description: 'Halvklart', emoji: night ? '🌙' : '⛅' };
  if (code === 3) return { description: 'Molnigt', emoji: '☁️' };
  if (code === 45 || code === 48) return { description: 'Dimma', emoji: '☁️' };
  if (code >= 51 && code <= 57) return { description: 'Duggregn', emoji: '🌧️' };
  if (code >= 61 && code <= 67) return { description: 'Regn', emoji: '🌧️' };
  if (code >= 71 && code <= 77) return { description: 'Snö', emoji: '❄️' };
  if (code >= 80 && code <= 82) return { description: 'Regnskurar', emoji: '🌦️' };
  if (code >= 85 && code <= 86) return { description: 'Snöbyar', emoji: '🌨️' };
  if (code >= 95 && code <= 99) return { description: 'Åska', emoji: '⛈️' };
  return { description: 'Okänt', emoji: '🌡️' };
};

// Cache helpers
const getCachedLocation = (): CachedLocation | null => {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
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

const getCachedWeather = (): CachedWeather | null => {
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    // Weather cache valid for 15 minutes
    if (Date.now() - data.timestamp > 15 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
};

const setCachedWeather = (weather: Omit<CachedWeather, 'timestamp'>) => {
  try {
    const data: CachedWeather = { ...weather, timestamp: Date.now() };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
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

  const locationRef = useRef<CachedLocation | null>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  const [weather, setWeather] = useState<WeatherData>(() => {
    // Try to use cached weather first for instant display
    const cachedWeather = getCachedWeather();
    if (cachedWeather) {
      return {
        temperature: cachedWeather.temperature,
        weatherCode: cachedWeather.weatherCode,
        description: cachedWeather.description,
        emoji: cachedWeather.emoji,
        city: cachedWeather.city,
        isLoading: false, // Already have data!
        error: null,
      };
    }
    
    // Fall back to location cache for city name
    const cachedLocation = getCachedLocation();
    return {
      temperature: 0,
      weatherCode: 0,
      description: '',
      emoji: getTimeBasedEmoji(),
      city: cachedLocation?.city || '',
      isLoading: true,
      error: null,
    };
  });

  const updateWeather = useCallback((data: Partial<WeatherData>) => {
    if (!mountedRef.current) return;
    setWeather(prev => ({ ...prev, ...data }));
  }, []);

  const fetchWeatherOnly = useCallback(async (lat: number, lon: number, city: string, showLoading = false) => {
    try {
      if (showLoading) updateWeather({ isLoading: true });
      
      const { temperature, weatherCode } = await fetchCurrentWeather(lat, lon);
      const info = getWeatherInfo(weatherCode);
      
      const weatherData = {
        temperature,
        weatherCode,
        description: info.description,
        emoji: info.emoji,
        city,
      };
      
      // Cache weather data for instant display on next visit
      setCachedWeather(weatherData);
      
      updateWeather({
        ...weatherData,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Weather fetch error:', err);
      updateWeather({ isLoading: false, error: 'unavailable' });
    }
  }, [updateWeather]);

  const updateLocation = useCallback(async (newLat: number, newLon: number, knownCity: string | null, source: 'gps' | 'ip' | 'fallback') => {
    const city = knownCity || await getCityName(newLat, newLon);
    const newLocation: CachedLocation = { lat: newLat, lon: newLon, city, source, timestamp: Date.now() };
    setCachedLocation(newLocation);
    locationRef.current = newLocation;
    await fetchWeatherOnly(newLat, newLon, city);
  }, [fetchWeatherOnly]);

  const checkForLocationChange = useCallback(async (silent = true) => {
    const cached = locationRef.current || getCachedLocation();
    
    // Always try GPS first - it's always accurate and real-time
    if (navigator.geolocation) {
      const gpsResult = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
          () => resolve(null),
          { timeout: 8000, enableHighAccuracy: false, maximumAge: 5 * 60 * 1000 } // 5 min cache for GPS
        );
      });

      if (gpsResult && mountedRef.current) {
        // If we have cached location, check if we've moved significantly
        if (cached) {
          const distance = getDistanceKm(cached.lat, cached.lon, gpsResult.lat, gpsResult.lon);
          if (distance < MOVEMENT_THRESHOLD_KM && cached.source === 'gps') {
            // Haven't moved much and already have GPS - just update weather
            await fetchWeatherOnly(cached.lat, cached.lon, cached.city);
            return;
          }
        }
        // New location or moved significantly
        await updateLocation(gpsResult.lat, gpsResult.lon, null, 'gps');
        return;
      }
    }

    // No GPS available - try IP and compare with cache
    const ipLocation = await getLocationByIP();
    if (ipLocation && mountedRef.current) {
      if (cached) {
        const distance = getDistanceKm(cached.lat, cached.lon, ipLocation.lat, ipLocation.lon);
        if (distance < MOVEMENT_THRESHOLD_KM) {
          // Haven't moved much - use cached location for stability
          await fetchWeatherOnly(cached.lat, cached.lon, cached.city);
          return;
        }
        // Moved significantly - update to new location
        console.log(`Location changed: moved ${distance.toFixed(1)}km`);
      }
      await updateLocation(ipLocation.lat, ipLocation.lon, ipLocation.city, 'ip');
      return;
    }

    // If we have cache and nothing else worked, use cache
    if (cached && mountedRef.current) {
      await fetchWeatherOnly(cached.lat, cached.lon, cached.city);
      return;
    }

    // Try fallback city
    if (fallbackCity && mountedRef.current) {
      try {
        const geo = await geocodeCity(fallbackCity);
        await updateLocation(geo.lat, geo.lon, geo.name, 'fallback');
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
  }, [fallbackCity, fetchWeatherOnly, updateLocation, updateWeather]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Initial load
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      // Show cached data immediately if available
      const cached = getCachedLocation();
      if (cached) {
        locationRef.current = cached;
        // Fetch weather with cache first, then check for location change in background
        fetchWeatherOnly(cached.lat, cached.lon, cached.city).then(() => {
          // After showing cached, check if we've moved
          checkForLocationChange(true);
        });
      } else {
        // No cache - do full location check
        checkForLocationChange(false);
      }
    }

    // Refresh weather periodically
    const weatherInterval = setInterval(() => {
      if (locationRef.current && mountedRef.current) {
        fetchWeatherOnly(
          locationRef.current.lat, 
          locationRef.current.lon, 
          locationRef.current.city
        );
      }
    }, refreshMs);

    // Listen for network changes - user might have moved to new wifi/location
    const handleOnline = () => {
      console.log('Network changed - checking location...');
      checkForLocationChange(true);
    };

    window.addEventListener('online', handleOnline);

    return () => {
      mountedRef.current = false;
      clearInterval(weatherInterval);
      window.removeEventListener('online', handleOnline);
    };
  }, [fallbackCity, refreshMs, fetchWeatherOnly, checkForLocationChange]);

  return weather;
};

/**
 * Preload location AND weather data for instant display.
 * Call this during login to have everything ready before user reaches home page.
 * Returns the cached location or null if all methods fail.
 */
export const preloadWeatherLocation = async (): Promise<CachedLocation | null> => {
  // Check if we already have fresh weather cache (less than 5 min)
  const existingWeather = getCachedWeather();
  const existingLocation = getCachedLocation();
  
  if (existingWeather && existingLocation) {
    const weatherAge = Date.now() - existingWeather.timestamp;
    const locationAge = Date.now() - existingLocation.timestamp;
    // If both caches are fresh (weather < 5min, location < 30min GPS), skip preload
    if (weatherAge < 5 * 60 * 1000 && locationAge < 30 * 60 * 1000 && existingLocation.source === 'gps') {
      return existingLocation;
    }
  }

  let location: CachedLocation | null = null;

  // Try GPS first (most accurate)
  if (navigator.geolocation) {
    const gpsResult = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, enableHighAccuracy: false, maximumAge: 30 * 60 * 1000 }
      );
    });

    if (gpsResult) {
      const city = await getCityName(gpsResult.lat, gpsResult.lon);
      location = { ...gpsResult, city, source: 'gps', timestamp: Date.now() };
      setCachedLocation(location);
    }
  }

  // Try IP geolocation if GPS failed
  if (!location) {
    const ipLocation = await getLocationByIP();
    if (ipLocation) {
      location = { ...ipLocation, source: 'ip', timestamp: Date.now() };
      setCachedLocation(location);
    }
  }

  // Use existing cache if nothing else worked
  if (!location && existingLocation) {
    location = existingLocation;
  }

  // Now fetch and cache the actual weather data
  if (location) {
    try {
      const { temperature, weatherCode } = await fetchCurrentWeather(location.lat, location.lon);
      const info = getWeatherInfo(weatherCode);
      setCachedWeather({
        temperature,
        weatherCode,
        description: info.description,
        emoji: info.emoji,
        city: location.city,
      });
    } catch (err) {
      console.warn('Weather preload fetch failed:', err);
    }
  }

  return location;
};
