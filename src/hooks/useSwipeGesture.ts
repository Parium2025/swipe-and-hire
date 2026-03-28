import { useCallback, useRef, TouchEvent } from 'react';

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

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
    }
    if (distance < -threshold && onSwipeRight) {
      onSwipeRight();
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
