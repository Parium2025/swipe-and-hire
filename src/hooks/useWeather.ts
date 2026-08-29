import { useEffect, useRef, useState, useCallback } from 'react';
import { useBackgroundLocation } from './useBackgroundLocation';
import { isNativeApp, isMobileWeb, getAccuratePosition, getDistanceKm, COARSE_FIX_ACCURACY_M } from '@/lib/gpsUtils';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import { isSlowConnection } from '@/hooks/useNetworkAwareFetch';
import {
  type CachedLocation,
  getCachedLocation,
  setCachedLocation,
  getCachedWeather,
  getStaleCachedWeather,
  setCachedWeather,
  getWeatherInfo,
  fetchCurrentWeather,
  getLocationByIP,
  getServerSideIPLocation,
  geocodeCity,
  getTimeBasedEmoji,
} from '@/lib/weatherApi';

// Re-export for consumers that import from here
export { clearWeatherCache } from '@/lib/weatherApi';

interface WeatherData {
  temperature: number;
  feelsLike: number;
  /**
   * True only when the temperature reading is real (not the neutral fallback).
   * UI must hide "X°" when this is false. See `hasConfirmedWeather` helper.
   */
  temperatureAvailable: boolean;
  weatherCode: number;
  description: string;
  emoji: string;
  city: string;
  isLoading: boolean;
  error: string | null;
  /**
   * Only 'gps' is treated as a confirmed, user-approved location. IP and
   * fallback readings must not render as weather.
   */
  source?: 'gps' | 'ip' | 'fallback';
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
  const retryAttemptRef = useRef(0);
  // Guards against overlapping location/weather resolutions (interval, tab focus,
  // GPS watcher and retry can all fire at once).
  const inFlightRef = useRef(false);
  // Monotonic sequence: a slow response from an older position must never
  // overwrite a newer one (otherwise you can see another city's temperature).
  const requestSeqRef = useRef(0);
  const [retryTick, setRetryTick] = useState(0);

  const safeFallback = useCallback((city = '', source?: 'gps' | 'ip' | 'fallback'): WeatherData => ({
    temperature: 0,
    feelsLike: 0,
    temperatureAvailable: false,
    weatherCode: 0,
    description: '',
    emoji: getTimeBasedEmoji(),
    city,
    isLoading: false,
    error: 'unavailable',
    source,
  }), []);

  const [weather, setWeather] = useState<WeatherData>(() => {
    const cached = getCachedWeather();
    const cachedLocation = getCachedLocation();
    if (cached) {
      return {
        temperature: cached.temperature,
        feelsLike: cached.feelsLike,
        temperatureAvailable: cached.temperatureAvailable === true,
        weatherCode: cached.weatherCode,
        description: cached.description,
        emoji: cached.emoji,
        city: cached.city,
        isLoading: false,
        error: null,
        source: cached.source ?? cachedLocation?.source,
      };
    }
    return {
      temperature: 0,
      feelsLike: 0,
      temperatureAvailable: false,
      weatherCode: 0,
      description: '',
      emoji: getTimeBasedEmoji(),
      city: '',
      isLoading: true,
      error: null,
      source: cachedLocation?.source,
    };
  });

  const updateWeather = useCallback((data: Partial<WeatherData>) => {
    if (!mountedRef.current) return;
    setWeather(prev => ({ ...prev, ...data }));
  }, []);

  const fetchWeatherOnly = useCallback(async (lat: number, lon: number, city: string, showLoading = false) => {
    const seq = ++requestSeqRef.current;
    try {
      if (showLoading) updateWeather({ isLoading: true });
      
      const result = await fetchCurrentWeather(lat, lon);
      // A newer request started while this one was in flight — discard.
      if (seq !== requestSeqRef.current) return;
      const { temperature, feelsLike, temperatureAvailable, weatherCode, isNight } = result;
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
        temperatureAvailable,
        weatherCode,
        description: info.description,
        emoji: info.emoji,
        city: resolvedCity,
        isNight,
      };
      
      // Never persist a neutral fallback reading — it would keep the UI empty
      // for the full cache window even after the upstream API recovers.
      if (temperatureAvailable) setCachedWeather(weatherData);
      
      updateWeather({
        ...weatherData,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      console.error('Weather fetch error:', err);
      // If a fresh fetch fails, prefer an older cached reading over hiding the
      // weather row. This smooths over transient API blips and weak connections.
      const stale = getStaleCachedWeather();
      if (stale) {
        updateWeather({
          temperature: stale.temperature,
          feelsLike: stale.feelsLike,
          temperatureAvailable: stale.temperatureAvailable,
          weatherCode: stale.weatherCode,
          description: stale.description,
          emoji: stale.emoji,
          city: stale.city || city,
          isLoading: false,
          error: null,
        });
      } else {
        updateWeather(safeFallback(city));
      }
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

  const runLocationCheck = useCallback(async (silent = true) => {
    try {
      // Fast first fix, automatically refined when the browser hands us an
      // IP-derived (city-wrong) position. Works the same in every country.
      const gpsResult = await getAccuratePosition({
        timeout: isNativeApp() ? 8000 : 6000,
        // Accept a fix up to 2 minutes old — avoids waking the radio on every
        // periodic/visibility check when we don't need a fresh lock.
        maximumAge: 2 * 60 * 1000,
      });

      if (gpsResult && mountedRef.current) {
        console.log(
          `🛰️ GPS coordinates: ${gpsResult.lat.toFixed(6)}, ${gpsResult.lon.toFixed(6)} (±${Math.round(gpsResult.accuracy)}m)`,
        );

        const cachedFix = locationRef.current || getCachedLocation();
        // A coarse fix must never overwrite a precise recent one (that is how a
        // laptop in Haninge ends up showing the ISP's city).
        if (
          gpsResult.accuracy > COARSE_FIX_ACCURACY_M &&
          cachedFix?.source === 'gps' &&
          Date.now() - cachedFix.timestamp < 30 * 60 * 1000
        ) {
          console.log('📍 Ignoring coarse fix — keeping recent precise location');
          await fetchWeatherOnly(cachedFix.lat, cachedFix.lon, cachedFix.city);
          return;
        }

        // Only reuse the cached city name when we are still in the same place —
        // otherwise let the server resolve the real city for the new coordinates.
        const nearCached =
          cachedFix && getDistanceKm(cachedFix.lat, cachedFix.lon, gpsResult.lat, gpsResult.lon) < 10;
        const cityHint = nearCached ? cachedFix?.city || '' : '';
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

    // Server-side IP lookup first — one shared edge function with per-IP cache
    // instead of every client hitting free third-party IP APIs directly.
    const ipLocation = (await getServerSideIPLocation().catch(() => null))
      ?? (await getLocationByIP().catch((error) => {
        console.warn('IP location lookup failed, continuing with fallbacks:', error);
        return null;
      }));
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

  /** Single-flight wrapper: overlapping triggers reuse the in-flight resolution. */
  const checkForLocationChange = useCallback(async (silent = true) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await runLocationCheck(silent);
    } finally {
      inFlightRef.current = false;
    }
  }, [runLocationCheck]);

  // Main initialization effect
  useEffect(() => {
    mountedRef.current = true;
    let watchId: number | null = null;
    if (!enabled) {
      return () => { mountedRef.current = false; };
    }

    // Use the connectivity manager's verdict instead of the unreliable
    // navigator.onLine. When offline we keep any cached weather visible (even
    // if it is slightly stale) so the header never flashes to an error state.
    const isOffline = !getIsOnline();

    if (!initializedRef.current) {
      initializedRef.current = true;

      const cachedLocation = getCachedLocation();
      const cachedWeather = getCachedWeather();

      if (cachedLocation && cachedWeather) {
        locationRef.current = cachedLocation;
        console.log('Using preloaded weather cache for instant display');

        if (!isOffline) {
          setTimeout(() => {
            if (mountedRef.current) checkForLocationChange(true);
          }, 2000);
        }
      } else if (!isOffline) {
        checkForLocationChange(false);
      } else {
        // Offline: prefer a stale cached reading over hiding the weather row.
        const stale = getStaleCachedWeather();
        if (stale) {
          updateWeather({
            temperature: stale.temperature,
            feelsLike: stale.feelsLike,
            temperatureAvailable: stale.temperatureAvailable,
            weatherCode: stale.weatherCode,
            description: stale.description,
            emoji: stale.emoji,
            city: stale.city,
            isLoading: false,
            error: null,
          });
        } else {
          // No cache at all — gracefully hide the weather row, but keep
          // the greeting and clock. The fallback city hint is preserved so a
          // name can still be shown if the consumer wants it.
          updateWeather(safeFallback(fallbackCity || ''));
        }
      }
    }

    // Real-time GPS via watchPosition (browser only). GPS itself works offline,
    // but we only push updates to the server when we are online.
    if ('geolocation' in navigator && !isNativeApp() && !isOffline) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLat = position.coords.latitude;
          const newLon = position.coords.longitude;
          const accuracy = position.coords.accuracy ?? Number.POSITIVE_INFINITY;

          const cached = locationRef.current;
          // Discard coarse (IP-derived) updates when we already know better.
          if (accuracy > COARSE_FIX_ACCURACY_M && cached?.source === 'gps') return;
          if (cached) {
            const distance = getDistanceKm(cached.lat, cached.lon, newLat, newLon);
            if (distance < 0.5) return;
            console.log(`📍 GPS watchPosition: moved ${distance.toFixed(2)}km - updating!`);
          }

          const stillNearby =
            cached && getDistanceKm(cached.lat, cached.lon, newLat, newLon) < 10;
          const cityHint = stillNearby ? cached?.city || '' : '';
          await updateLocation(newLat, newLon, cityHint || null, 'gps');
        },
        (error) => {
          console.warn('GPS watchPosition error:', error.message);
        },
        {
          // Desktop: high accuracy (wifi positioning, no battery cost).
          // Mobile web: low accuracy so the GPS radio stays asleep.
          enableHighAccuracy: !isMobileWeb(),
          timeout: 10000,
          maximumAge: 5 * 60 * 1000,
        }
      );
      console.log('🛰️ Real-time GPS tracking started via watchPosition');
    }

    // Fallback: Check periodically. On slow connections we back off to avoid
    // stacking requests on an already strained link.
    const trackingIntervalMs = isSlowConnection() ? 20 * 60 * 1000 : 10 * 60 * 1000;
    const gpsTrackingInterval = setInterval(() => {
      if (mountedRef.current && getIsOnline()) {
        checkForLocationChange(true);
      }
    }, trackingIntervalMs);

    const handleConnectivity = (online: boolean) => {
      if (online && mountedRef.current) {
        console.log('Network changed - checking location...');
        retryAttemptRef.current = 0;
        checkForLocationChange(true);
      }
    };

    const unsubscribeConnectivity = onConnectivityChange(handleConnectivity);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        if (!getIsOnline()) return;
        const cachedWeather = getCachedWeather();
        if (cachedWeather && Date.now() - cachedWeather.timestamp < 3 * 60 * 1000) {
          return;
        }
        console.log('Tab visible - checking for location change...');
        checkForLocationChange(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        console.log('🛰️ Real-time GPS tracking stopped');
      }
      clearInterval(gpsTrackingInterval);
      unsubscribeConnectivity();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, fallbackCity, fetchWeatherOnly, checkForLocationChange, updateWeather, updateLocation, safeFallback]);

  // Retry watcher — isolated from the init effect so a transient failure never
  // tears down and restarts the GPS watcher.
  useEffect(() => {
    if (!enabled || !weather.error) {
      retryAttemptRef.current = 0;
      return;
    }
    if (!getIsOnline()) return;

    // Exponential backoff on total failure: 30s → 2min → 5min (capped)
    const delays = [30_000, 120_000, 300_000];
    const attempt = retryAttemptRef.current;
    const delay = delays[Math.min(attempt, delays.length - 1)];
    retryAttemptRef.current = attempt + 1;

    const id = setTimeout(() => {
      if (!mountedRef.current || !getIsOnline()) return;
      console.log(`🔁 Weather retry attempt ${attempt + 1}`);
      void checkForLocationChange(true).finally(() => {
        // Re-arm: the error string is identical between failures, so we need an
        // explicit tick to schedule the next (longer) backoff step.
        if (mountedRef.current) setRetryTick(t => t + 1);
      });
    }, delay);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, weather.error, retryTick, checkForLocationChange]);

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

  const gpsResult = await getAccuratePosition({
    timeout: 5000,
    maximumAge: 30 * 60 * 1000,
  });

  if (gpsResult) {
    // City will be resolved server-side when we fetch weather below
    location = { ...gpsResult, city: '', source: 'gps', timestamp: Date.now() };
    setCachedLocation(location);
  }

  if (!location) {
    const ipLocation = (await getServerSideIPLocation().catch(() => null))
      ?? (await getLocationByIP().catch(() => null));
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
      const { temperature, feelsLike, temperatureAvailable, weatherCode, isNight, cachedCity } = result;
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
        temperatureAvailable,
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
