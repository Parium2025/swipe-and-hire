import { useEffect, useRef, useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useBackgroundLocation } from './useBackgroundLocation';
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
  /** Whether to enable weather fetching, default true */
  enabled?: boolean;
  /** Whether to enable background location updates (native only), default false */
  backgroundLocationEnabled?: boolean;
}

const LOCATION_CACHE_KEY = 'parium_weather_location';
const WEATHER_CACHE_KEY = 'parium_weather_data';
const MOVEMENT_THRESHOLD_KM = 10; // If moved more than 10km, update location (for IP fallback)

// Clear all weather cache - used for debugging or forcing fresh data
export const clearWeatherCache = () => {
  try {
    localStorage.removeItem(LOCATION_CACHE_KEY);
    localStorage.removeItem(WEATHER_CACHE_KEY);
    console.log('Weather cache cleared');
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

// Check if running as native app (Capacitor)
const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

// Get current GPS position - uses native Capacitor GPS on mobile, browser API on web
const getCurrentPosition = async (options?: { 
  timeout?: number; 
  enableHighAccuracy?: boolean; 
  maximumAge?: number;
}): Promise<{ lat: number; lon: number } | null> => {
  const timeout = options?.timeout ?? 8000;
  const enableHighAccuracy = options?.enableHighAccuracy ?? true;
  const maximumAge = options?.maximumAge ?? 0;

  try {
    // Use Capacitor native GPS on mobile for best experience
    if (isNativeApp()) {
      console.log('Using native Capacitor GPS');
      const position = await Geolocation.getCurrentPosition({
        timeout,
        enableHighAccuracy,
        maximumAge,
      });
      return {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
    }
    
    // Fall back to browser API on web
    if (navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ 
            lat: position.coords.latitude, 
            lon: position.coords.longitude 
          }),
          () => resolve(null),
          { timeout, enableHighAccuracy, maximumAge }
        );
      });
    }
    
    return null;
  } catch (error) {
    console.warn('GPS error:', error);
    return null;
  }
};

// Check GPS permission status - works on both native and web
const checkGpsPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  try {
    if (isNativeApp()) {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'granted' || status.coarseLocation === 'granted') {
        return 'granted';
      }
      if (status.location === 'denied') {
        return 'denied';
      }
      return 'prompt';
    }
    
    // Browser API
    if ('permissions' in navigator) {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state as 'granted' | 'denied' | 'prompt';
    }
    
    return 'prompt';
  } catch {
    return 'prompt';
  }
};

// Request GPS permission on native (triggers OS permission dialog)
const requestGpsPermission = async (): Promise<boolean> => {
  try {
    if (isNativeApp()) {
      const status = await Geolocation.requestPermissions();
      return status.location === 'granted' || status.coarseLocation === 'granted';
    }
    // On web, permission is requested when getCurrentPosition is called
    return true;
  } catch {
    return false;
  }
};

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

// Cache helpers - location cache valid for 3 minutes max (was 10)
const LOCATION_CACHE_MAX_AGE = 3 * 60 * 1000; // 3 minutes - faster location detection

const getCachedLocation = (): CachedLocation | null => {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    // Location cache expires after 10 minutes to ensure freshness
    if (Date.now() - data.timestamp > LOCATION_CACHE_MAX_AGE) {
      console.log('Location cache expired, will refresh');
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

// Weather cache valid for 5 minutes (optimal - weather doesn't change faster)
const WEATHER_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

const getCachedWeather = (): CachedWeather | null => {
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > WEATHER_CACHE_MAX_AGE) return null;
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

// Clean up city name - remove "kommun" suffix for cleaner display
const cleanCityName = (name: string): string => {
  if (!name) return '';
  // Remove " kommun" suffix (case-insensitive) and trim
  return name.replace(/\s+kommun$/i, '').trim();
};

// Reverse geocoding to get city name - with multiple fallback services
const getCityName = async (lat: number, lon: number): Promise<string> => {
  // Try Nominatim first (most reliable for Swedish cities)
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=sv`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      const city =
        data.address?.city ||
        data.address?.town ||
        data.address?.municipality ||
        data.address?.village ||
        data.address?.suburb ||
        data.address?.county ||
        '';
      if (city) return cleanCityName(city);
    }
  } catch {
    // Try fallback
  }

  // Fallback: BigDataCloud (free, no API key needed)
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sv`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      const city = data.city || data.locality || data.principalSubdivision || '';
      if (city) return cleanCityName(city);
    }
  } catch {
    // Both services failed
  }

  return '';
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
  const fallbackCity = options.fallbackCity?.trim();
  const enabled = options.enabled ?? true;
  const backgroundLocationEnabled = options.backgroundLocationEnabled ?? false;

  const locationRef = useRef<CachedLocation | null>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);
  const backgroundUpdatePendingRef = useRef(false);

  const [weather, setWeather] = useState<WeatherData>(() => {
    // Try to use cached weather data for instant display (from preload during login)
    const cached = getCachedWeather();
    if (cached) {
      return {
        temperature: cached.temperature,
        feelsLike: cached.feelsLike,
        weatherCode: cached.weatherCode,
        description: cached.description,
        emoji: cached.emoji,
        city: cached.city,
        isLoading: false, // Show cached immediately!
        error: null,
      };
    }
    
    // No cache - start loading
    return {
      temperature: 0,
      feelsLike: 0,
      weatherCode: 0,
      description: '',
      emoji: getTimeBasedEmoji(),
      city: '',
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

  const updateLocation = useCallback(async (newLat: number, newLon: number, knownCity: string | null, source: 'gps' | 'ip' | 'fallback' | 'background') => {
    const city = knownCity || await getCityName(newLat, newLon);
    const newLocation: CachedLocation = { lat: newLat, lon: newLon, city, source: source === 'background' ? 'gps' : source, timestamp: Date.now() };
    setCachedLocation(newLocation);
    locationRef.current = newLocation;
    await fetchWeatherOnly(newLat, newLon, city);
  }, [fetchWeatherOnly]);

  // Handler for background location updates (from native app)
  const handleBackgroundLocationUpdate = useCallback(async (lat: number, lon: number) => {
    // Debounce - don't update if we already have a recent update
    if (backgroundUpdatePendingRef.current) return;
    
    const cached = locationRef.current;
    if (cached) {
      const distance = getDistanceKm(cached.lat, cached.lon, lat, lon);
      // Only update if moved more than 500 meters
      if (distance < 0.5) {
        console.log('Background update: not enough movement, skipping');
        return;
      }
      console.log(`Background update: moved ${distance.toFixed(2)}km, updating weather`);
    }
    
    backgroundUpdatePendingRef.current = true;
    try {
      await updateLocation(lat, lon, null, 'background');
    } finally {
      backgroundUpdatePendingRef.current = false;
    }
  }, [updateLocation]);

  // Use background location tracking on native platforms (only if user has enabled it)
  useBackgroundLocation({
    onLocationUpdate: handleBackgroundLocationUpdate,
    distanceFilter: 500, // 500 meters minimum between updates
    enabled: enabled && backgroundLocationEnabled && isNativeApp(),
  });

  const checkForLocationChange = useCallback(async (silent = true) => {
    // Always try GPS first - uses native Capacitor on mobile, browser API on web
    const gpsResult = await getCurrentPosition({
      timeout: 8000,
      enableHighAccuracy: true,
      maximumAge: 0, // Always get fresh GPS
    });

    if (gpsResult && mountedRef.current) {
      console.log(`🛰️ GPS coordinates: ${gpsResult.lat.toFixed(6)}, ${gpsResult.lon.toFixed(6)}`);
      
      // Always get fresh city name from GPS coordinates - never trust cache
      const freshCity = await getCityName(gpsResult.lat, gpsResult.lon);
      
      if (freshCity) {
        console.log(`📍 Reverse geocoding result: "${freshCity}"`);
        // We have fresh GPS coordinates and fresh city name - use them
        await updateLocation(gpsResult.lat, gpsResult.lon, freshCity, 'gps');
        return;
      }
      
      // Reverse geocoding failed but we have GPS - use coordinates with cached city name if available
      const cached = locationRef.current || getCachedLocation();
      const cityFallback = cached?.source === 'gps' ? cached.city : '';
      console.log(`⚠️ Reverse geocoding failed, using GPS coords with fallback city: "${cityFallback}"`);
      await updateLocation(gpsResult.lat, gpsResult.lon, cityFallback || null, 'gps');
      return;
    }

    // GPS not available - check if we have recent GPS cache before falling back to IP
    const cached = locationRef.current || getCachedLocation();
    
    // If we have a recent GPS cache (less than 10 minutes), prefer it over IP
    if (cached && cached.source === 'gps' && mountedRef.current) {
      const cacheAge = Date.now() - cached.timestamp;
      if (cacheAge < 10 * 60 * 1000) {
        console.log('Using recent GPS cache instead of IP fallback');
        await fetchWeatherOnly(cached.lat, cached.lon, cached.city);
        return;
      }
    }

    // No GPS or old cache - try IP (but be aware it can be inaccurate!)
    const ipLocation = await getLocationByIP();
    if (ipLocation && mountedRef.current) {
      // CRITICAL: IP geolocation often returns datacenter locations (like "Ludvika")
      // Only trust IP if we have NO GPS cache at all
      if (cached && cached.source === 'gps') {
        // We have GPS cache - IP result might be wrong, use GPS cache instead
        console.log('⚠️ Ignoring IP location (might be datacenter), using GPS cache');
        await fetchWeatherOnly(cached.lat, cached.lon, cached.city);
        return;
      }
      
      // No GPS cache at all - have to use IP as last resort
      console.log(`📡 Using IP geolocation: ${ipLocation.city} (accuracy may vary)`);
      await updateLocation(ipLocation.lat, ipLocation.lon, ipLocation.city, 'ip');
      return;
    }

    // If we have any cache and nothing else worked, use cache
    if (cached && mountedRef.current) {
      console.log('Using cached location as fallback');
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

  // Main initialization effect
  useEffect(() => {
    mountedRef.current = true;
    let watchId: number | null = null;
    
    // If not enabled, skip weather fetching entirely
    if (!enabled) {
      return () => {
        mountedRef.current = false;
      };
    }
    
    // Initial load - use cached data if available, then refresh GPS in background
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      // Check if we already have valid cached location (from preload during login)
      const cachedLocation = getCachedLocation();
      const cachedWeather = getCachedWeather();
      
      if (cachedLocation && cachedWeather) {
        // We have cached data from preload - use it immediately
        locationRef.current = cachedLocation;
        console.log('Using preloaded weather cache for instant display');
        
        // Still do a background GPS refresh to ensure accuracy, but don't show loading
        setTimeout(() => {
          if (mountedRef.current) {
            checkForLocationChange(true); // Silent refresh
          }
        }, 2000); // Small delay to let UI settle
      } else {
        // No cache - do full fresh check with loading state
        checkForLocationChange(false);
      }
    }

    // 🚀 REAL-TIME GPS: Use watchPosition for instant location updates
    // This is the browser's built-in continuous GPS tracking - completely free!
    if ('geolocation' in navigator && !isNativeApp()) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLat = position.coords.latitude;
          const newLon = position.coords.longitude;
          
          const cached = locationRef.current;
          if (cached) {
            const distance = getDistanceKm(cached.lat, cached.lon, newLat, newLon);
            // Only update if moved more than 500 meters (0.5 km)
            if (distance < 0.5) {
              return; // Not enough movement
            }
            console.log(`📍 GPS watchPosition: moved ${distance.toFixed(2)}km - updating!`);
          }
          
          // Get fresh city name and update
          const city = await getCityName(newLat, newLon);
          await updateLocation(newLat, newLon, city, 'gps');
        },
        (error) => {
          console.warn('GPS watchPosition error:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000, // Accept positions up to 30 seconds old
        }
      );
      console.log('🛰️ Real-time GPS tracking started via watchPosition');
    }

    // Fallback: Check GPS location every 3 minutes for devices where watchPosition fails
    const gpsTrackingInterval = setInterval(() => {
      if (mountedRef.current) {
        checkForLocationChange(true);
      }
    }, 3 * 60 * 1000); // 3 minutes fallback

    // Listen for network changes - user might have moved to new wifi/location
    const handleOnline = () => {
      console.log('Network changed - checking location...');
      checkForLocationChange(true);
    };

    // Update location + weather when user comes back to tab/app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        console.log('Tab visible - checking for location change...');
        checkForLocationChange(true);
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        console.log('🛰️ Real-time GPS tracking stopped');
      }
      clearInterval(gpsTrackingInterval);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, fallbackCity, fetchWeatherOnly, checkForLocationChange, updateWeather, updateLocation]);

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

  // Try GPS first (most accurate) - uses native Capacitor on mobile, browser API on web
  const gpsResult = await getCurrentPosition({
    timeout: 5000,
    enableHighAccuracy: false,
    maximumAge: 30 * 60 * 1000,
  });

  if (gpsResult) {
    const city = await getCityName(gpsResult.lat, gpsResult.lon);
    location = { ...gpsResult, city, source: 'gps', timestamp: Date.now() };
    setCachedLocation(location);
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
