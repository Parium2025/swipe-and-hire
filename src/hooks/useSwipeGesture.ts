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
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const touchEndYRef = useRef<number | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchEndXRef.current = null;
    touchEndYRef.current = null;
    touchStartXRef.current = e.targetTouches[0].clientX;
    touchStartYRef.current = e.targetTouches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
    touchEndYRef.current = e.targetTouches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(() => {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const endX = touchEndXRef.current;
    const endY = touchEndYRef.current;
    if (startX === null || endX === null || startY === null || endY === null) return;

    const dx = startX - endX;
    const dy = startY - endY;

    // Only trigger swipe if horizontal movement is dominant (at least 1.5x vertical)
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0 && onSwipeLeft) {
        onSwipeLeft();
      }
      if (dx < 0 && onSwipeRight) {
        onSwipeRight();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchEndXRef.current = null;
    touchEndYRef.current = null;
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
