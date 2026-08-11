import { useEffect, useRef } from 'react';

/** Locks the app's real scroll surface while a body-portaled overlay is open. */
export function useOverlayBackgroundLock() {
  useEffect(() => {
    const root = document.getElementById('root');
    const html = document.documentElement;
    const body = document.body;
    if (!root) return;

    const previousOverflow = root.style.overflow;
    const previousTouchAction = root.style.touchAction;
    const previousPointerEvents = root.style.pointerEvents;
    const wasInert = root.inert;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const preventBackgroundPan = (event: TouchEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-onboarding-scroll="true"]')) return;
      event.preventDefault();
    };
    root.style.overflow = 'hidden';
    root.style.touchAction = 'none';
    root.style.pointerEvents = 'none';
    root.inert = true;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    document.addEventListener('touchmove', preventBackgroundPan, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventBackgroundPan);
      root.style.overflow = previousOverflow;
      root.style.touchAction = previousTouchAction;
      root.style.pointerEvents = previousPointerEvents;
      root.inert = wasInert;
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
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

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        previousY = null;
        return;
      }
      previousY = event.touches[0].clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (previousY === null || event.touches.length !== 1) return;
      const nextY = event.touches[0].clientY;
      const delta = previousY - nextY;
      previousY = nextY;
      if (delta === 0 || element.scrollHeight <= element.clientHeight) return;

      const maxScroll = element.scrollHeight - element.clientHeight;
      element.scrollTop = Math.min(maxScroll, Math.max(0, element.scrollTop + delta));
      event.preventDefault();
    };

    const endTouch = () => {
      previousY = null;
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', endTouch, { passive: true });
    element.addEventListener('touchcancel', endTouch, { passive: true });

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', endTouch);
      element.removeEventListener('touchcancel', endTouch);
    };
  }, []);

  return ref;
}