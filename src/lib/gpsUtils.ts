import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

/** Check if running as native app (Capacitor) */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** Unified GPS permission check for both native and web */
export const checkGpsPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
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

/** Request GPS permission - native shows OS dialog, web triggers on getCurrentPosition */
export const requestGpsPermission = async (): Promise<boolean> => {
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

/** Get current GPS position - uses native Capacitor GPS on mobile, browser API on web */
export interface GpsFix {
  lat: number;
  lon: number;
  /** Reported horizontal accuracy in metres (Infinity when unknown). */
  accuracy: number;
}

/** True for mobile browsers, where high-accuracy GPS drains the battery. */
export const isMobileWeb = (): boolean =>
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const getCurrentPosition = async (options?: { 
  timeout?: number; 
  enableHighAccuracy?: boolean; 
  maximumAge?: number;
}): Promise<GpsFix | null> => {
  const timeout = options?.timeout ?? 8000;
  const enableHighAccuracy = options?.enableHighAccuracy ?? true;
  const maximumAge = options?.maximumAge ?? 0;

  try {
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
        accuracy: position.coords.accuracy ?? Number.POSITIVE_INFINITY,
      };
    }
    
    // Fall back to browser API on web
    if (navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy ?? Number.POSITIVE_INFINITY,
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

/**
 * Coarser than this and the "fix" is almost certainly derived from the ISP's IP
 * address rather than wifi/GPS — that is what makes a laptop in Haninge report
 * the ISP hub's city (e.g. Helsingborg).
 */
export const COARSE_FIX_ACCURACY_M = 20_000;

/**
 * Best-effort position: takes a fast fix first, and when that fix is clearly
 * IP-derived it immediately re-tries with high accuracy (wifi triangulation)
 * and keeps whichever answer is more precise. Works anywhere in the world.
 */
export const getAccuratePosition = async (options?: {
  timeout?: number;
  maximumAge?: number;
}): Promise<GpsFix | null> => {
  const timeout = options?.timeout ?? 6000;
  const maximumAge = options?.maximumAge ?? 2 * 60 * 1000;
  // Desktop browsers have no battery penalty for high accuracy, and it is the
  // only way to get wifi-based positioning instead of an IP guess.
  const fastHighAccuracy = isNativeApp() || !isMobileWeb();

  const first = await getCurrentPosition({ timeout, enableHighAccuracy: fastHighAccuracy, maximumAge });
  if (first && first.accuracy <= COARSE_FIX_ACCURACY_M) return first;

  console.warn(
    `📍 Coarse position (${first ? Math.round(first.accuracy) + 'm' : 'none'}) — retrying with high accuracy`,
  );
  const refined = await getCurrentPosition({ timeout, enableHighAccuracy: true, maximumAge: 0 });
  if (refined && (!first || refined.accuracy < first.accuracy)) return refined;
  return first;
};

/** Calculate distance between two coordinates in km (Haversine formula) */
export const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
