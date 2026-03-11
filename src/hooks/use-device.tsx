import { useRef, useSyncExternalStore } from 'react';

// Desktop breakpoint - below this we use mobile/tablet layout with sidebar
const MOBILE_BREAKPOINT = 1024;

export type DeviceType = 'mobile' | 'desktop';

function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
}

// Debounced singleton: prevents transient resize events (e.g. iOS address bar
// retract when opening the sidebar) from flipping the layout between mobile
// and desktop, which would unmount the entire component tree.
let stableDevice: DeviceType = getDeviceType();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let deviceListeners: Set<() => void> | null = null;

function subscribeDevice(callback: () => void): () => void {
  if (!deviceListeners) {
    deviceListeners = new Set();
    const handler = () => {
      const next = getDeviceType();
      // Only notify if the value actually changed AND stays stable for 150ms
      if (next !== stableDevice) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const confirmed = getDeviceType();
          if (confirmed !== stableDevice) {
            stableDevice = confirmed;
            deviceListeners!.forEach(fn => fn());
          }
        }, 150);
      }
    };
    window.addEventListener('resize', handler, { passive: true });
    window.addEventListener('orientationchange', handler, { passive: true });
  }
  deviceListeners.add(callback);
  return () => {
    deviceListeners!.delete(callback);
  };
}

function getDeviceSnapshot(): DeviceType {
  return stableDevice;
}

function getDeviceServerSnapshot(): DeviceType {
  return 'desktop';
}

export function useDevice(): DeviceType {
  return useSyncExternalStore(subscribeDevice, getDeviceSnapshot, getDeviceServerSnapshot);
}

// Non-reactive version for SSR or one-time checks
export function getDevice(): DeviceType {
  return getDeviceType();
}
