import { useSyncExternalStore } from 'react';

/**
 * Detects the primary input capability of the device.
 *
 * - 'touch'  → device only has coarse pointer (phone, tablet)
 * - 'mouse'  → device only has fine pointer (desktop with mouse/trackpad)
 * - 'hybrid' → device has BOTH (Surface, touch-laptop, iPad with keyboard)
 *
 * Uses CSS pointer media queries for reliable detection across platforms,
 * including Android, iOS, and desktop browsers.
 *
 * This hook is INDEPENDENT of viewport size — a large tablet with touch
 * returns 'touch', a small laptop with mouse returns 'mouse'.
 */

export type InputCapability = 'touch' | 'mouse' | 'hybrid';

function detectInputCapability(): InputCapability {
  if (typeof window === 'undefined') return 'mouse'; // SSR default

  const hasCoarse = window.matchMedia('(pointer: coarse)').matches;
  const hasFine = window.matchMedia('(pointer: fine)').matches;

  // Also check any-pointer for devices that have both
  const anyCoarse = window.matchMedia('(any-pointer: coarse)').matches;
  const anyFine = window.matchMedia('(any-pointer: fine)').matches;

  // Hybrid: device reports both fine AND coarse pointers
  // (e.g. Surface with pen+touch+mouse, iPad with Magic Keyboard)
  if (anyCoarse && anyFine) return 'hybrid';

  // Primary pointer is coarse → pure touch device
  if (hasCoarse && !hasFine) return 'touch';

  // Primary pointer is fine → pure mouse/trackpad device
  if (hasFine && !hasCoarse) return 'mouse';

  // Fallback: check maxTouchPoints for edge cases
  if (navigator.maxTouchPoints > 0) return 'touch';

  return 'mouse';
}

// Singleton subscription — shared across all hook instances
let inputListeners: Set<() => void> | null = null;

function subscribeInputCapability(callback: () => void): () => void {
  if (!inputListeners) {
    inputListeners = new Set();
    const handler = () => inputListeners!.forEach(fn => fn());

    // Listen for pointer capability changes (e.g. docking/undocking keyboard)
    const coarseMql = window.matchMedia('(pointer: coarse)');
    const fineMql = window.matchMedia('(pointer: fine)');

    // Modern browsers support addEventListener on MediaQueryList
    if (coarseMql.addEventListener) {
      coarseMql.addEventListener('change', handler);
      fineMql.addEventListener('change', handler);
    } else {
      // Safari <14 fallback
      coarseMql.addListener(handler);
      fineMql.addListener(handler);
    }
  }
  inputListeners.add(callback);
  return () => {
    inputListeners!.delete(callback);
  };
}

function getInputSnapshot(): InputCapability {
  return detectInputCapability();
}

function getInputServerSnapshot(): InputCapability {
  return 'mouse';
}

/**
 * React hook that returns the current input capability.
 * Updates automatically if the device's pointer capability changes
 * (e.g. connecting/disconnecting a mouse or keyboard on a tablet).
 *
 * Usage:
 *   const input = useInputCapability();
 *   if (input !== 'mouse') { // show swipe mode }
 */
export function useInputCapability(): InputCapability {
  return useSyncExternalStore(
    subscribeInputCapability,
    getInputSnapshot,
    getInputServerSnapshot
  );
}

/**
 * Non-reactive version for one-time checks or SSR.
 */
export function getInputCapability(): InputCapability {
  return detectInputCapability();
}

/**
 * Helper: returns true if device supports touch input.
 * Useful for conditionally enabling swipe gestures.
 */
export function useTouchCapable(): boolean {
  const input = useInputCapability();
  return input === 'touch' || input === 'hybrid';
}
