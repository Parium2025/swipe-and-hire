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
    root.style.overflow = 'hidden';
    root.style.touchAction = 'none';
    root.style.pointerEvents = 'none';
    root.inert = true;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
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
  return ref;
}