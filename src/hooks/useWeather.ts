import { useEffect, useRef, useState, useCallback } from 'react';

interface WeatherData {
  temperature: number;
  feelsLike: number;
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
  /** Whether to enable weather fetching, default true */
  enabled?: boolean;
}

const DEFAULT_REFRESH_MS = 15 * 60 * 1000;
const LOCATION_CACHE_KEY = 'parium_weather_location';
const WEATHER_CACHE_KEY = 'parium_weather_data';
const PROFILE_CITY_KEY = 'parium_weather_profile_city';
const MOVEMENT_THRESHOLD_KM = 10; // If moved more than 10km, update location

// Clear all weather cache - used when profile location changes
const clearWeatherCache = () => {
  try {
    localStorage.removeItem(LOCATION_CACHE_KEY);
    localStorage.removeItem(WEATHER_CACHE_KEY);
    console.log('Weather cache cleared due to profile change');
  } catch {
    // Silent fail
  }
};

// Store and check if profile city has changed
const getStoredProfileCity = (): string | null => {
  try {
    return localStorage.getItem(PROFILE_CITY_KEY);
  } catch {
    return null;
  }
};

const setStoredProfileCity = (city: string) => {
  try {
    localStorage.setItem(PROFILE_CITY_KEY, city);
  } catch {
    // Silent fail
  }
};

interface CachedWeather {
  temperature: number;
  feelsLike: number;
  weatherCode: number;
  description: string;
  emoji: string;
  city: string;
  isNight: boolean;
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

// Weather codes from Open-Meteo API - detailed descriptions
const getWeatherInfo = (code: number, isNight: boolean): { description: string; emoji: string } => {
  // Clear sky
  if (code === 0) return { description: 'Klart', emoji: isNight ? '🌙' : '☀️' };
  
  // Partly cloudy
  if (code === 1) return { description: 'Mestadels klart', emoji: isNight ? '🌙' : '🌤️' };
  if (code === 2) return { description: 'Halvklart', emoji: isNight ? '🌙 ☁️' : '⛅' };
  
  // Overcast
  if (code === 3) return { description: 'Molnigt', emoji: '☁️' };
  
  // Fog
  if (code === 45) return { description: 'Dimma', emoji: '🌁' };
  if (code === 48) return { description: 'Rimfrost', emoji: '🌁' };
  
  // Drizzle
  if (code === 51) return { description: 'Lätt duggregn', emoji: '🌧️' };
  if (code === 53) return { description: 'Duggregn', emoji: '🌧️' };
  if (code === 55) return { description: 'Kraftigt duggregn', emoji: '🌧️' };
  if (code === 56) return { description: 'Lätt underkylt regn', emoji: '🌧️' };
  if (code === 57) return { description: 'Underkylt regn', emoji: '🌧️' };
  
  // Rain
  if (code === 61) return { description: 'Lätt regn', emoji: '🌧️' };
  if (code === 63) return { description: 'Regn', emoji: '🌧️' };
  if (code === 65) return { description: 'Kraftigt regn', emoji: '🌧️' };
  if (code === 66) return { description: 'Lätt isregn', emoji: '🌧️' };
  if (code === 67) return { description: 'Isregn', emoji: '🌧️' };
  
  // Snow
  if (code === 71) return { description: 'Lätt snö', emoji: '❄️' };
  if (code === 73) return { description: 'Snö', emoji: '❄️' };
  if (code === 75) return { description: 'Kraftigt snöfall', emoji: '❄️' };
  if (code === 77) return { description: 'Snöhagel', emoji: '❄️' };
  
  // Rain showers
  if (code === 80) return { description: 'Lätta regnskurar', emoji: '🌦️' };
  if (code === 81) return { description: 'Regnskurar', emoji: '🌦️' };
  if (code === 82) return { description: 'Skyfall', emoji: '🌦️' };
  
  // Snow showers
  if (code === 85) return { description: 'Lätta snöbyar', emoji: '🌨️' };
  if (code === 86) return { description: 'Kraftiga snöbyar', emoji: '🌨️' };
  
  // Thunderstorm
  if (code === 95) return { description: 'Åska', emoji: '⛈️' };
  if (code === 96) return { description: 'Åska med hagel', emoji: '⛈️' };
  if (code === 99) return { description: 'Kraftig åska', emoji: '⛈️' };
  
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
    // Weather cache valid for 5 minutes only (was 15)
    if (Date.now() - data.timestamp > 5 * 60 * 1000) return null;
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
  // Include daily sunrise/sunset to determine if it's night
  // Include apparent_temperature for "feels like"
  // timezone=auto ensures times are in the location's local timezone
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&daily=sunrise,sunset&timezone=auto`
  );
  const data = await res.json();
  const current = data?.current;
  if (!current) throw new Error('Missing current weather data');
  
  // Use the API's reported time (which is in the location's timezone) for accurate comparison
  const currentTimeStr = current.time; // e.g., "2026-01-04T16:30"
  const todayStr = currentTimeStr?.split('T')[0];
  
  const dailyIndex = data.daily?.time?.indexOf(todayStr) ?? 0;
  const sunrise = data.daily?.sunrise?.[dailyIndex];
  const sunset = data.daily?.sunset?.[dailyIndex];
  
  let isNight = false;
  if (sunrise && sunset && currentTimeStr) {
    // Compare times as strings since they're all in the same timezone from the API
    // Format: "2026-01-04T07:30" - can be compared lexicographically
    isNight = currentTimeStr < sunrise || currentTimeStr > sunset;
  }
  
  return {
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    weatherCode: current.weather_code as number,
    isNight,
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

type GeoPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

const getGeolocationPermissionState = async (): Promise<GeoPermissionState> => {
  try {
    if (!('permissions' in navigator) || !navigator.permissions?.query) return 'unknown';
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    if (result.state === 'granted' || result.state === 'denied' || result.state === 'prompt') return result.state;
    return 'unknown';
  } catch {
    return 'unknown';
  }
};

const normalizeCityQuery = (input: string): string => {
  // Examples:
  // - "Vega/136 55" -> "Vega"
  // - "Haninge kommun" -> "Haninge kommun"
  return input.split(/[\\/,-]/)[0]?.trim() ?? '';
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
  const enabled = options.enabled ?? true;

  const locationRef = useRef<CachedLocation | null>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);
  const prevFallbackCityRef = useRef<string | undefined>(undefined);

  const [weather, setWeather] = useState<WeatherData>(() => {
    // CRITICAL: Check if profile city has changed since last visit
    // If so, clear all cached data to force fresh location lookup
    if (fallbackCity) {
      const storedProfileCity = getStoredProfileCity();
      if (storedProfileCity && storedProfileCity.toLowerCase() !== fallbackCity.toLowerCase()) {
        console.log(`Profile city changed: ${storedProfileCity} → ${fallbackCity}`);
        clearWeatherCache();
      }
      // Always store current profile city
      setStoredProfileCity(fallbackCity);
    }
    
    // Now check cache (may have just been cleared if profile changed)
    const cachedWeather = getCachedWeather();
    const cachedLocation = getCachedLocation();
    
    // Don't use cache if it's from a different city than user's profile
    const isCacheStale = fallbackCity && cachedWeather?.city && 
      cachedWeather.city.toLowerCase() !== fallbackCity.toLowerCase();
    
    if (cachedWeather && !isCacheStale) {
      return {
        temperature: cachedWeather.temperature,
        feelsLike: cachedWeather.feelsLike ?? cachedWeather.temperature,
        weatherCode: cachedWeather.weatherCode,
        description: cachedWeather.description,
        emoji: cachedWeather.emoji,
        city: cachedWeather.city,
        isLoading: false,
        error: null,
      };
    }
    
    // Use fallback city as initial display if available
    return {
      temperature: 0,
      feelsLike: 0,
      weatherCode: 0,
      description: '',
      emoji: getTimeBasedEmoji(),
      city: fallbackCity || cachedLocation?.city || '',
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
      
      const { temperature, feelsLike, weatherCode, isNight } = await fetchCurrentWeather(lat, lon);
      const info = getWeatherInfo(weatherCode, isNight);
      
      const weatherData = {
        temperature,
        feelsLike,
        weatherCode,
        description: info.description,
        emoji: info.emoji,
        city,
        isNight,
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

  // 🔄 AUTOMATIC RESYNC: When fallbackCity becomes available or changes,
  // and current weather city doesn't match, force update from profile location
  useEffect(() => {
    // Skip if no fallbackCity provided
    if (!fallbackCity) {
      prevFallbackCityRef.current = undefined;
      return;
    }

    const normalizedFallback = normalizeCityQuery(fallbackCity);
    const prevFallback = prevFallbackCityRef.current;
    prevFallbackCityRef.current = fallbackCity;

    // Check if this is a new/changed fallbackCity
    const fallbackJustBecameAvailable = !prevFallback && fallbackCity;
    const fallbackChanged = prevFallback && prevFallback.toLowerCase() !== fallbackCity.toLowerCase();

    if (!fallbackJustBecameAvailable && !fallbackChanged) {
      return; // No change, skip
    }

    // Check if current weather city matches the profile location
    const currentCity = weather.city?.toLowerCase() || '';
    const profileCity = normalizedFallback.toLowerCase();

    // If they already match (roughly), no need to resync
    if (currentCity && (currentCity.includes(profileCity) || profileCity.includes(currentCity))) {
      console.log(`Weather city "${weather.city}" matches profile "${fallbackCity}" - no resync needed`);
      return;
    }

    // Check if we have GPS - if GPS is granted, trust it over profile
    (async () => {
      const gpsPermission = await getGeolocationPermissionState();
      
      if (gpsPermission === 'granted') {
        // GPS is active - it should be accurate, but let's double-check by triggering a location check
        console.log(`GPS granted but city mismatch. Triggering location check...`);
        checkForLocationChange(true);
        return;
      }

      // No GPS - profile location is our best source of truth
      console.log(`Profile city mismatch: current="${weather.city}" vs profile="${fallbackCity}". Resyncing...`);
      
      // Clear stale cache
      clearWeatherCache();
      
      // Geocode the profile city and update
      try {
        const geo = await geocodeCity(normalizedFallback);
        if (mountedRef.current) {
          await updateLocation(geo.lat, geo.lon, geo.name, 'fallback');
          console.log(`Resynced to profile location: ${geo.name}`);
        }
      } catch (err) {
        console.warn('Failed to geocode profile city for resync:', err);
        // Try the full location check as fallback
        checkForLocationChange(true);
      }
    })();
  }, [fallbackCity, weather.city, checkForLocationChange, updateLocation]);

  useEffect(() => {
    mountedRef.current = true;
    
    // If not enabled, skip weather fetching entirely
    if (!enabled) {
      return () => {
        mountedRef.current = false;
      };
    }
    
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

    // Refresh weather every 5 minutes automatically in background
    const weatherInterval = setInterval(() => {
      if (locationRef.current && mountedRef.current) {
        fetchWeatherOnly(
          locationRef.current.lat, 
          locationRef.current.lon, 
          locationRef.current.city
        );
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Listen for network changes - user might have moved to new wifi/location
    const handleOnline = () => {
      console.log('Network changed - checking location...');
      checkForLocationChange(true);
    };

    // Update weather when user comes back to tab/app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && locationRef.current && mountedRef.current) {
        // Check if weather cache is stale (older than 5 min)
        const cached = getCachedWeather();
        const isStale = !cached || (Date.now() - cached.timestamp > 5 * 60 * 1000);
        if (isStale) {
          console.log('Tab visible + stale cache - updating weather...');
          fetchWeatherOnly(locationRef.current.lat, locationRef.current.lon, locationRef.current.city);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      clearInterval(weatherInterval);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, fallbackCity, refreshMs, fetchWeatherOnly, checkForLocationChange]);

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
      const { temperature, feelsLike, weatherCode, isNight } = await fetchCurrentWeather(location.lat, location.lon);
      const info = getWeatherInfo(weatherCode, isNight);
      setCachedWeather({
        temperature,
        feelsLike,
        weatherCode,
        description: info.description,
        emoji: info.emoji,
        city: location.city,
        isNight,
      });
    } catch (err) {
      console.warn('Weather preload fetch failed:', err);
    }
  }

  return location;
};
