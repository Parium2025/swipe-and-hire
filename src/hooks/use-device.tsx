import { useSyncExternalStore } from 'react';

// Mobile breakpoint - below this we use mobile layout with sidebar
const MOBILE_BREAKPOINT = 768;

export type DeviceType = 'mobile' | 'desktop';

function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
}

// Singleton subscription - shared across all hook instances (no duplicate listeners)
let deviceListeners: Set<() => void> | null = null;
function subscribeDevice(callback: () => void): () => void {
  if (!deviceListeners) {
    deviceListeners = new Set();
    const handler = () => deviceListeners!.forEach(fn => fn());
    window.addEventListener('resize', handler, { passive: true });
    window.addEventListener('orientationchange', handler, { passive: true });
  }
  deviceListeners.add(callback);
  return () => {
    deviceListeners!.delete(callback);
  };
}

function getDeviceSnapshot(): DeviceType {
  return getDeviceType();
}

function getDeviceServerSnapshot(): DeviceType {
  return 'desktop';
}

export function useDevice(): DeviceType {
  // useSyncExternalStore: no useEffect delay, instant sync on first render
  return useSyncExternalStore(subscribeDevice, getDeviceSnapshot, getDeviceServerSnapshot);
}

// Non-reactive version for SSR or one-time checks
export function getDevice(): DeviceType {
  return getDeviceType();
}
