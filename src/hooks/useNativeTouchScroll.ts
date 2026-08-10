import { useEffect, useRef } from 'react';

/** Locks the app's real scroll surface while a body-portaled overlay is open. */
export function useOverlayBackgroundLock() {
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;

    const previousOverflow = root.style.overflow;
    const previousTouchAction = root.style.touchAction;
    const previousPointerEvents = root.style.pointerEvents;
    const wasInert = root.inert;
    root.style.overflow = 'hidden';
    root.style.touchAction = 'none';
    root.style.pointerEvents = 'none';
    root.inert = true;

    return () => {
      root.style.overflow = previousOverflow;
      root.style.touchAction = previousTouchAction;
      root.style.pointerEvents = previousPointerEvents;
      root.inert = wasInert;
    };
  }, []);
}

/**
 * Native touch fallback for iOS WebKit overlays.
 * Safari can occasionally route a pan past a fixed, portal-mounted scroller.
 * This keeps the gesture on the intended element without affecting mouse/wheel.
 */
export function useNativeTouchScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let previousY: number | null = null;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        previousY = null;
        return;
      }
      previousY = event.touches[0].clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (previousY === null || event.touches.length !== 1) return;

      const currentY = event.touches[0].clientY;
      const deltaY = previousY - currentY;
      previousY = currentY;

      const maxScrollTop = element.scrollHeight - element.clientHeight;
      if (maxScrollTop <= 0) return;

      element.scrollTop = Math.min(maxScrollTop, Math.max(0, element.scrollTop + deltaY));
      event.preventDefault();
      event.stopPropagation();
    };

    const handleTouchEnd = () => {
      previousY = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  return ref;
}