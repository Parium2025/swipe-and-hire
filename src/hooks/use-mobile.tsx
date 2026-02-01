import { useEffect, useState, useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768

// SSR-safe: compute once synchronously to avoid hydration mismatch & extra renders
function getIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

// Singleton subscription for resize - shared across all hook instances
let listeners: Set<() => void> | null = null;
function subscribe(callback: () => void): () => void {
  if (!listeners) {
    listeners = new Set();
    const handler = () => listeners!.forEach(fn => fn());
    window.addEventListener('resize', handler, { passive: true });
    window.addEventListener('orientationchange', handler, { passive: true });
  }
  listeners.add(callback);
  return () => {
    listeners!.delete(callback);
  };
}

function getSnapshot(): boolean {
  return getIsMobile();
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  // useSyncExternalStore avoids the initial undefined → boolean render cycle
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
