import { useEffect, useRef, useCallback } from 'react';

/**
 * 🚀 TOUCH OPTIMIZATION UTILITIES
 * 
 * Premium touch-optimering för Spotify-känsla på mobil:
 * - Passiva event listeners (scrollar utan att blocka)
 * - Debounced scroll handlers
 * - Touch feedback utilities
 */

// Global touch device detection (cached)
let isTouchDeviceCached: boolean | null = null;
export const isTouchDevice = (): boolean => {
  if (isTouchDeviceCached !== null) return isTouchDeviceCached;
  isTouchDeviceCached = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return isTouchDeviceCached;
};

// Global slow connection detection (cached with refresh)
let slowConnectionCacheTime = 0;
let slowConnectionCached: boolean | null = null;
export const isSlowConnection = (): boolean => {
  const now = Date.now();
  // Refresh cache every 30 seconds
  if (slowConnectionCached !== null && now - slowConnectionCacheTime < 30000) {
    return slowConnectionCached;
  }
  
  slowConnectionCacheTime = now;
  
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
        slowConnectionCached = true;
        return true;
      }
      if (conn.saveData) {
        slowConnectionCached = true;
        return true;
      }
      if (typeof conn.downlink === 'number' && conn.downlink < 1) {
        slowConnectionCached = true;
        return true;
      }
    }
  }
  
  slowConnectionCached = false;
  return false;
};

/**
 * Hook för optimerad scroll-hantering
 * Använder passiva listeners och debouncing
 */
export const useOptimizedScroll = (
  callback: (scrollY: number) => void,
  debounceMs: number = 16 // ~60fps
) => {
  const ticking = useRef(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      lastScrollY.current = window.scrollY;
      
      if (!ticking.current) {
        requestAnimationFrame(() => {
          callback(lastScrollY.current);
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    // Passiv listener - blockerar INTE scrolling
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [callback, debounceMs]);
};

/**
 * Hook för touch feedback (haptic-like visual feedback)
 */
export const useTouchFeedback = () => {
  const addPressEffect = useCallback((element: HTMLElement) => {
    if (!isTouchDevice()) return;
    
    const handleTouchStart = () => {
      element.style.transform = 'scale(0.97)';
      element.style.transition = 'transform 0.1s ease-out';
    };
    
    const handleTouchEnd = () => {
      element.style.transform = '';
    };
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);
  
  return { addPressEffect, isTouchDevice: isTouchDevice() };
};

/**
 * Hook för att förhindra scroll medan en dialog/modal är öppen
 * Optimerad för touch
 */
export const usePreventScroll = (isActive: boolean) => {
  useEffect(() => {
    if (!isActive) return;
    
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const scrollY = window.scrollY;
    
    // Lock scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    
    return () => {
      // Restore scroll position
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isActive]);
};

/**
 * CSS containment helper - returnerar inline styles för isolering
 */
export const getContainmentStyles = (type: 'strict' | 'content' | 'layout' = 'content') => ({
  contain: type === 'strict' ? 'strict' : type === 'content' ? 'content' : 'layout style paint',
});

/**
 * Debounce utility för touch events
 */
export const debounceTouch = <T extends (...args: any[]) => void>(
  fn: T,
  delay: number = 100
): T => {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
};
