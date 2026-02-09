import { useCallback, useRef, TouchEvent } from 'react';

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

/**
 * Lightweight swipe gesture hook.
 * Uses refs instead of state to avoid re-renders on every touchMove,
 * which was causing scroll jank on mobile.
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: UseSwipeGestureOptions) {
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchEndRef.current = null;
    touchStartRef.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(() => {
    const start = touchStartRef.current;
    const end = touchEndRef.current;
    if (start === null || end === null) return;
    
    const distance = start - end;
    if (distance > threshold && onSwipeLeft) {
      onSwipeLeft();
    } else if (distance < -threshold && onSwipeRight) {
      onSwipeRight();
    }
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
