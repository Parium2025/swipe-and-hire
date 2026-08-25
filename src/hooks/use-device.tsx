import { useRef, useSyncExternalStore } from 'react';

// Desktop breakpoint - below this we use mobile/tablet layout with sidebar.
// 1180px (not 1024px): the employer top nav needs ~1120px before its items
// start to collide/overflow, so we switch to the mobile layout with margin
// instead of rendering a cramped desktop header.
const MOBILE_BREAKPOINT = 1180;

// Overflow guard: the top nav reports the width it actually needs (measured
// with a ResizeObserver). If real content needs more than the static
// breakpoint - e.g. a very long company name or a future nav item - we raise
// the effective breakpoint so we flip to the mobile layout *before* anything
// visually collides. The +48px is breathing room, and since the value only
// ever grows there is built-in hysteresis (no flip-flop loop).
let measuredBreakpoint = 0;

export function reportNavRequiredWidth(requiredPx: number): void {
  const next = Math.round(requiredPx) + 48;
  if (next <= measuredBreakpoint || next <= MOBILE_BREAKPOINT) return;
  measuredBreakpoint = next;
  const confirmed = getDeviceType();
  if (confirmed !== stableDevice) {
    stableDevice = confirmed;
    deviceListeners?.forEach(fn => fn());
  }
}

function effectiveBreakpoint(): number {
  return Math.max(MOBILE_BREAKPOINT, measuredBreakpoint);
}

export type DeviceType = 'mobile' | 'desktop';

function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < effectiveBreakpoint() ? 'mobile' : 'desktop';
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
