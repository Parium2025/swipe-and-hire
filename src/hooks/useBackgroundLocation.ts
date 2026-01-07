import { useEffect, useRef, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { 
  BackgroundGeolocationPlugin, 
  Location, 
  CallbackError 
} from '@capacitor-community/background-geolocation';

// Register the plugin for native platforms
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation'
);

// Re-export types for consumers
export type { Location as BackgroundLocation, CallbackError };

interface UseBackgroundLocationOptions {
  /** Called when location updates in background */
  onLocationUpdate?: (lat: number, lon: number) => void;
  /** Minimum distance in meters between updates (default: 500m) */
  distanceFilter?: number;
  /** Enable background tracking (default: true on native) */
  enabled?: boolean;
}

export const useBackgroundLocation = (options: UseBackgroundLocationOptions = {}) => {
  const {
    onLocationUpdate,
    distanceFilter = 500, // 500 meters default
    enabled = true,
  } = options;

  const watcherIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const startBackgroundTracking = useCallback(async () => {
    // Only works on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('Background location only available on native platforms');
      return false;
    }

    try {
      // Remove existing watcher if any
      if (watcherIdRef.current) {
        await BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
        watcherIdRef.current = null;
      }

      const watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Parium uppdaterar vädret baserat på din plats',
          backgroundTitle: 'Platsuppdatering',
          requestPermissions: true,
          stale: false,
          distanceFilter,
        },
        (location, error) => {
          if (error) {
            if (error?.code === 'NOT_AUTHORIZED') {
              console.warn('Background location not authorized');
            }
            return;
          }

          if (location && mountedRef.current && onLocationUpdate) {
            console.log('Background location update:', location.latitude, location.longitude);
            onLocationUpdate(location.latitude, location.longitude);
          }
        }
      );

      watcherIdRef.current = watcherId;
      console.log('Background location tracking started');
      return true;
    } catch (err) {
      console.error('Failed to start background location:', err);
      return false;
    }
  }, [distanceFilter, onLocationUpdate]);

  const stopBackgroundTracking = useCallback(async () => {
    if (!watcherIdRef.current) return;

    try {
      await BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
      watcherIdRef.current = null;
      console.log('Background location tracking stopped');
    } catch (err) {
      console.error('Failed to stop background location:', err);
    }
  }, []);

  const openLocationSettings = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      await BackgroundGeolocation.openSettings();
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled && Capacitor.isNativePlatform()) {
      startBackgroundTracking();
    }

    return () => {
      mountedRef.current = false;
      stopBackgroundTracking();
    };
  }, [enabled, startBackgroundTracking, stopBackgroundTracking]);

  return {
    startBackgroundTracking,
    stopBackgroundTracking,
    openLocationSettings,
    isNative: Capacitor.isNativePlatform(),
  };
};

export default useBackgroundLocation;
