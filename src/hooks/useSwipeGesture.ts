import { useCallback, useRef, TouchEvent } from 'react';
import { hapticSwipeTick } from '@/lib/haptics';

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
      if ((dx > 0 && onSwipeLeft) || (dx < 0 && onSwipeRight)) {
        hapticSwipeTick();
      }
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

/**
 * Apple-style direction lock for horizontal swipe cards.
 * Once a touch is clearly horizontal the page is held still (no vertical
 * nudge/rubber-band); a clearly vertical drag scrolls the page as usual.
 * Uses a native non-passive listener because React touch handlers are passive.
 */
export function useHorizontalSwipeLock<T extends HTMLElement>(enabled = true) {
  const cleanupRef = useRef<(() => void) | null>(null);

  return useCallback((node: T | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!node || !enabled) return;

    let startX = 0;
    let startY = 0;
    let axis: 'x' | 'y' | null = null;

    const onStart = (e: globalThis.TouchEvent) => {
      if (e.touches.length !== 1) { axis = 'y'; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = null;
    };
    const onMove = (e: globalThis.TouchEvent) => {
      if (axis === 'y' || e.touches.length !== 1) return;
      if (axis === null) {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx < 6 && dy < 6) return;
        axis = dx > dy ? 'x' : 'y';
      }
      if (axis === 'x' && e.cancelable) e.preventDefault();
    };
    const onEnd = () => { axis = null; };

    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchmove', onMove, { passive: false });
    node.addEventListener('touchend', onEnd, { passive: true });
    node.addEventListener('touchcancel', onEnd, { passive: true });
    cleanupRef.current = () => {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);
}
