import { useEffect, useRef, useState, useCallback } from 'react';
import { useBackgroundLocation } from './useBackgroundLocation';
import { isNativeApp, getCurrentPosition, getDistanceKm } from '@/lib/gpsUtils';
import {
  type CachedLocation,
  getCachedLocation,
  setCachedLocation,
  getCachedWeather,
  setCachedWeather,
  getWeatherInfo,
  fetchCurrentWeather,
  getLocationByIP,
  geocodeCity,
  getTimeBasedEmoji,
} from '@/lib/weatherApi';

// Re-export for consumers that import from here
export { clearWeatherCache } from '@/lib/weatherApi';

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

interface UseWeatherOptions {
  /** Used when all location methods fail */
  fallbackCity?: string;
  /** Whether to enable weather fetching, default true */
  enabled?: boolean;
  /** Whether to enable background location updates (native only), default false */
  backgroundLocationEnabled?: boolean;
}

export const useWeather = (options: UseWeatherOptions = {}): WeatherData => {
  const fallbackCity = options.fallbackCity?.trim();
  const enabled = options.enabled ?? true;
  const backgroundLocationEnabled = options.backgroundLocationEnabled ?? false;

  const locationRef = useRef<CachedLocation | null>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);
  const backgroundUpdatePendingRef = useRef(false);

  const safeFallback = useCallback((city = ''): WeatherData => ({
    temperature: 0,
    feelsLike: 0,
    weatherCode: 0,
    description: '',
    emoji: getTimeBasedEmoji(),
    city,
    isLoading: false,
    error: 'unavailable',
  }), []);

  const [weather, setWeather] = useState<WeatherData>(() => {
    const cached = getCachedWeather();
    if (cached) {
      return {
        temperature: cached.temperature,
        feelsLike: cached.feelsLike,
        weatherCode: cached.weatherCode,
        description: cached.description,
        emoji: cached.emoji,
        city: cached.city,
        isLoading: false,
        error: null,
      };
    }
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
      
      const result = await fetchCurrentWeather(lat, lon);
      const { temperature, feelsLike, weatherCode, isNight } = result;
      // Use server-cached city if we don't have one yet
      const resolvedCity = city || result.cachedCity || '';
      
      // Update location cache with server-provided city if we didn't have one
      if (resolvedCity && !city && locationRef.current) {
        locationRef.current = { ...locationRef.current, city: resolvedCity };
        setCachedLocation(locationRef.current);
      }
      
      const info = getWeatherInfo(weatherCode, isNight);
      
      const weatherData = {
        temperature,
        feelsLike,
        weatherCode,
        description: info.description,
        emoji: info.emoji,
        city: resolvedCity,
        isNight,
      };
      
      setCachedWeather(weatherData);
      
      updateWeather({
        ...weatherData,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Weather fetch error:', err);
      updateWeather(safeFallback(city));
    }
  }, [safeFallback, updateWeather]);

  const updateLocation = useCallback(async (newLat: number, newLon: number, knownCity: string | null, source: 'gps' | 'ip' | 'fallback' | 'background') => {
    // City is resolved server-side by the edge function (fetchCurrentWeather returns cachedCity).
    // We pass knownCity as a hint; fetchWeatherOnly will use the server-cached city if knownCity is empty.
    const city = knownCity || '';
    const newLocation: CachedLocation = { lat: newLat, lon: newLon, city, source: source === 'background' ? 'gps' : source, timestamp: Date.now() };
    setCachedLocation(newLocation);
    locationRef.current = newLocation;
    await fetchWeatherOnly(newLat, newLon, city);
  }, [fetchWeatherOnly]);

  // Handler for background location updates (from native app)
  const handleBackgroundLocationUpdate = useCallback(async (lat: number, lon: number) => {
    if (backgroundUpdatePendingRef.current) return;
    
    const cached = locationRef.current;
    if (cached) {
      const distance = getDistanceKm(cached.lat, cached.lon, lat, lon);
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

  useBackgroundLocation({
    onLocationUpdate: handleBackgroundLocationUpdate,
    distanceFilter: 500,
    enabled: enabled && backgroundLocationEnabled && isNativeApp(),
  });

  const checkForLocationChange = useCallback(async (silent = true) => {
    try {
      const gpsResult = await getCurrentPosition({
        timeout: 8000,
        enableHighAccuracy: true,
        maximumAge: 0,
      });

      if (gpsResult && mountedRef.current) {
        console.log(`🛰️ GPS coordinates: ${gpsResult.lat.toFixed(6)}, ${gpsResult.lon.toFixed(6)}`);

        // Don't call getCityName directly — the edge function (fetchCurrentWeather)
        // already returns a cached city via server-side reverse geocoding.
        // Calling Nominatim from each client would hit its 1 req/s rate limit at scale.
        const cached = locationRef.current || getCachedLocation();
        const cityHint = cached?.city || '';
        await updateLocation(gpsResult.lat, gpsResult.lon, cityHint || null, 'gps');
        return;
      }
    } catch (error) {
      console.warn('GPS lookup failed, continuing with fallbacks:', error);
    }

    const cached = locationRef.current || getCachedLocation();
    
    if (cached && cached.source === 'gps' && mountedRef.current) {
      const cacheAge = Date.now() - cached.timestamp;
      if (cacheAge < 10 * 60 * 1000) {
        console.log('Using recent GPS cache instead of IP fallback');
        await fetchWeatherOnly(cached.lat, cached.lon, cached.city);
        return;
      }
    }

    const ipLocation = await getLocationByIP().catch((error) => {
      console.warn('IP location lookup failed, continuing with fallbacks:', error);
      return null;
    });
    if (ipLocation && mountedRef.current) {
      if (cached && cached.source === 'gps') {
        console.log('⚠️ Ignoring IP location (might be datacenter), using GPS cache');
        await fetchWeatherOnly(cached.lat, cached.lon, cached.city);
        return;
      }
      
      console.log(`📡 Using IP geolocation: ${ipLocation.city} (accuracy may vary)`);
      await updateLocation(ipLocation.lat, ipLocation.lon, ipLocation.city, 'ip');
      return;
    }

    if (cached && mountedRef.current) {
      console.log('Using cached location as fallback');
      await fetchWeatherOnly(cached.lat, cached.lon, cached.city);
      return;
    }

    if (fallbackCity && mountedRef.current) {
      try {
        const geo = await geocodeCity(fallbackCity);
        await updateLocation(geo.lat, geo.lon, geo.name, 'fallback');
        return;
      } catch { /* Fallback city geocoding failed */ }
    }

    if (mountedRef.current) {
      updateWeather(safeFallback(fallbackCity || ''));
    }
  }, [fallbackCity, fetchWeatherOnly, safeFallback, updateLocation, updateWeather]);

  // Main initialization effect
  useEffect(() => {
    mountedRef.current = true;
    let watchId: number | null = null;
    
    if (!enabled) {
      return () => { mountedRef.current = false; };
    }
    
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      const cachedLocation = getCachedLocation();
      const cachedWeather = getCachedWeather();
      
      if (cachedLocation && cachedWeather) {
        locationRef.current = cachedLocation;
        console.log('Using preloaded weather cache for instant display');
        
        setTimeout(() => {
          if (mountedRef.current) {
            checkForLocationChange(true);
          }
        }, 2000);
      } else {
        checkForLocationChange(false);
      }
    }

    // Real-time GPS via watchPosition (browser only)
    if ('geolocation' in navigator && !isNativeApp()) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLat = position.coords.latitude;
          const newLon = position.coords.longitude;
          
          const cached = locationRef.current;
          if (cached) {
            const distance = getDistanceKm(cached.lat, cached.lon, newLat, newLon);
            if (distance < 0.5) return;
            console.log(`📍 GPS watchPosition: moved ${distance.toFixed(2)}km - updating!`);
          }
          
          // Don't call getCityName from client — edge function provides city server-side
          const cityHint = cached?.city || '';
          await updateLocation(newLat, newLon, cityHint || null, 'gps');
        },
        (error) => {
          console.warn('GPS watchPosition error:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
      console.log('🛰️ Real-time GPS tracking started via watchPosition');
    }

    // Fallback: Check every 3 minutes
    const gpsTrackingInterval = setInterval(() => {
      if (mountedRef.current) {
        checkForLocationChange(true);
      }
    }, 3 * 60 * 1000);

    const handleOnline = () => {
      console.log('Network changed - checking location...');
      checkForLocationChange(true);
    };

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
 */
export const preloadWeatherLocation = async (): Promise<CachedLocation | null> => {
  const existingWeather = getCachedWeather();
  const existingLocation = getCachedLocation();
  
  if (existingWeather && existingLocation) {
    const weatherAge = Date.now() - existingWeather.timestamp;
    const locationAge = Date.now() - existingLocation.timestamp;
    if (weatherAge < 5 * 60 * 1000 && locationAge < 30 * 60 * 1000 && existingLocation.source === 'gps') {
      return existingLocation;
    }
  }

  let location: CachedLocation | null = null;

  const gpsResult = await getCurrentPosition({
    timeout: 5000,
    enableHighAccuracy: false,
    maximumAge: 30 * 60 * 1000,
  });

  if (gpsResult) {
    // City will be resolved server-side when we fetch weather below
    location = { ...gpsResult, city: '', source: 'gps', timestamp: Date.now() };
    setCachedLocation(location);
  }

  if (!location) {
    const ipLocation = await getLocationByIP();
    if (ipLocation) {
      location = { ...ipLocation, source: 'ip', timestamp: Date.now() };
      setCachedLocation(location);
    }
  }

  if (!location && existingLocation) {
    location = existingLocation;
  }

  if (location) {
    try {
      const result = await fetchCurrentWeather(location.lat, location.lon);
      const { temperature, feelsLike, weatherCode, isNight, cachedCity } = result;
      // Use server-provided city, update location cache with resolved city
      const resolvedCity = cachedCity || location.city || '';
      if (resolvedCity && !location.city) {
        location = { ...location, city: resolvedCity };
        setCachedLocation(location);
      }
      const info = getWeatherInfo(weatherCode, isNight);
      setCachedWeather({
        temperature,
        feelsLike,
        weatherCode,
        description: info.description,
        emoji: info.emoji,
        city: resolvedCity,
        isNight,
      });
    } catch (err) {
      console.warn('Weather preload fetch failed:', err);
    }
  }

  return location;
};
