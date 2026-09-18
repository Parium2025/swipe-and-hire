import { useCallback, useRef, useState, type RefObject, type TouchEvent } from 'react';

interface UsePullToDismissOptions {
  /** Element that the user touches (the page wrapper). Used to find its
   *  scrollable ancestor so the gesture only fires when scrolled to top. */
  wrapperRef: RefObject<HTMLElement>;
  /** Called after the slide-down animation finishes when the user has
   *  pulled past the dismiss threshold. */
  onDismiss: () => void;
  /** Threshold in px the finger must travel before we commit to dismiss. */
  threshold?: number;
  /** Cap so the page can never be dragged absurdly far. */
  maxPull?: number;
  /** Only run on touch devices. Mouse/trackpad ignored. */
  enabled?: boolean;
}

/**
 * iOS-style "drag from top to dismiss" gesture.
 *
 * Mirrors the exact pattern used by `JobView` (the job-seeker job page) so the
 * employer-side `/job-details/:id` view feels identical: pull down from the
 * top of the page and the whole view slides off, then navigates back.
 */
export function usePullToDismiss({
  wrapperRef,
  onDismiss,
  threshold = 110,
  maxPull = 320,
  enabled = true,
}: UsePullToDismissOptions) {
  const [pullY, setPullY] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const pullStartXRef = useRef<number | null>(null);
  const pullActiveRef = useRef(false);

  const getScrollContainer = useCallback((): Element | Window => {
    let el: HTMLElement | null = wrapperRef.current;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const oy = style.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
        return el;
      }
      el = el.parentElement;
    }
    return window;
  }, [wrapperRef]);

  const getScrollTop = useCallback((): number => {
    const c = getScrollContainer();
    return c === window ? window.scrollY : (c as Element).scrollTop;
  }, [getScrollContainer]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    if (getScrollTop() > 0) {
      pullStartYRef.current = null;
      return;
    }
    pullStartYRef.current = e.touches[0].clientY;
    pullStartXRef.current = e.touches[0].clientX;
    pullActiveRef.current = false;
  }, [enabled, getScrollTop]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (pullStartYRef.current === null) return;
    const dy = e.touches[0].clientY - pullStartYRef.current;
    const dx = e.touches[0].clientX - (pullStartXRef.current ?? 0);
    if (dy <= 0) {
      if (pullActiveRef.current) setPullY(0);
      pullStartYRef.current = null;
      pullActiveRef.current = false;
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      pullStartYRef.current = null;
      return;
    }
    if (getScrollTop() > 0) {
      pullStartYRef.current = null;
      if (pullActiveRef.current) setPullY(0);
      pullActiveRef.current = false;
      return;
    }
    pullActiveRef.current = true;
    setPullY(Math.min(dy * 0.5, maxPull));
  }, [getScrollTop, maxPull]);

  const onTouchEnd = useCallback(() => {
    const wasActive = pullActiveRef.current;
    const finalY = pullY;
    pullStartYRef.current = null;
    pullStartXRef.current = null;
    pullActiveRef.current = false;
    if (wasActive && finalY > threshold) {
      setIsDismissing(true);
      const target = typeof window !== 'undefined' ? window.innerHeight : 900;
      setPullY(target);
      setTimeout(() => {
        onDismiss();
      }, 320);
    } else {
      setPullY(0);
    }
  }, [pullY, threshold, onDismiss]);

  const style = {
    transform: pullY > 0 ? `translate3d(0, ${pullY}px, 0)` : undefined,
    transition: pullActiveRef.current
      ? 'none'
      : isDismissing
        ? 'transform 320ms cubic-bezier(0.32, 0.72, 0.24, 1)'
        : 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
  } as const;

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
    style,
    isDismissing,
  };
}
