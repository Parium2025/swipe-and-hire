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
export const getCurrentPosition = async (options?: { 
  timeout?: number; 
  enableHighAccuracy?: boolean; 
  maximumAge?: number;
}): Promise<{ lat: number; lon: number } | null> => {
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
