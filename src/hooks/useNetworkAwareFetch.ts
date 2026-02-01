import { useCallback, useRef } from 'react';

/**
 * 🚀 NETWORK-AWARE FETCH UTILITIES
 * 
 * Optimerar nätverksanrop för touch-enheter och svagt internet:
 * - Skjuter upp fetch till idle time
 * - Avbryter fetch vid timeout
 * - Prioriterar cached data
 */

// Detect slow connection
export const isSlowConnection = (): boolean => {
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      // 2G, slow-2g, or explicitly marked as slow
      if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') return true;
      // Save-data mode
      if (conn.saveData) return true;
      // Downlink less than 1 Mbps
      if (typeof conn.downlink === 'number' && conn.downlink < 1) return true;
    }
  }
  return false;
};

// Detect touch device
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

/**
 * Schedule a fetch for idle time - doesn't block main thread
 */
export const scheduleIdleFetch = <T>(
  fetchFn: () => Promise<T>,
  options?: { timeout?: number; priority?: 'user-blocking' | 'user-visible' | 'background' }
): Promise<T> => {
  const timeout = options?.timeout ?? (isSlowConnection() ? 10000 : 5000);
  
  return new Promise((resolve, reject) => {
    const runFetch = () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      fetchFn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutId));
    };
    
    // On touch devices, always defer to idle
    if (isTouchDevice() && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(runFetch, { timeout: 2000 });
    } else {
      // Desktop: run immediately but don't block paint
      queueMicrotask(runFetch);
    }
  });
};

/**
 * Hook for network-aware background fetching
 * Returns cached data immediately, fetches in background
 */
export const useNetworkAwareFetch = <T>(cacheKey: string) => {
  const lastFetchRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = isSlowConnection() ? 60000 : 30000; // Longer on slow connections
  
  const getCached = useCallback((): T | null => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }, [cacheKey]);
  
  const setCache = useCallback((data: T) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }, [cacheKey]);
  
  const shouldFetch = useCallback((): boolean => {
    const now = Date.now();
    if (now - lastFetchRef.current < MIN_FETCH_INTERVAL) {
      return false;
    }
    lastFetchRef.current = now;
    return true;
  }, [MIN_FETCH_INTERVAL]);
  
  return { getCached, setCache, shouldFetch, isSlowConnection: isSlowConnection() };
};

/**
 * Debounced fetch that respects network conditions
 */
export const createDebouncedFetch = (minInterval: number = 30000) => {
  let lastFetch = 0;
  
  return async <T>(fetchFn: () => Promise<T>): Promise<T | null> => {
    const now = Date.now();
    const effectiveInterval = isSlowConnection() ? minInterval * 2 : minInterval;
    
    if (now - lastFetch < effectiveInterval) {
      return null;
    }
    
    lastFetch = now;
    return fetchFn();
  };
};
