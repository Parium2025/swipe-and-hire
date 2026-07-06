import { useCallback, useEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { animate, type MotionValue, type PanInfo } from 'framer-motion';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import {
  DOUBLE_TAP_DELAY,
  EXIT_OPACITY_DURATION,
  EXIT_SPRING,
  EXIT_X,
  OVERLAY_CLOSE_INPUT_LOCK_MS,
  PREMIUM_EASE,
  SNAP_SPRING,
  SWIPE_THRESHOLD,
  TAP_MAX_DURATION,
  TAP_MOVE_THRESHOLD,
  TAP_RESET_VELOCITY_THRESHOLD,
  TOUCH_DRAG_INTENT_THRESHOLD,
  UNDERLAY_INITIAL_SCALE,
  UNDERLAY_INITIAL_Y,
  UNDERLAY_OPACITY_DURATION,
  UNDERLAY_RISE_SPRING,
  VELOCITY_THRESHOLD,
} from './constants';
import { isWithinInteractiveTarget, isWithinTapHintTarget } from './utils';

export type SwipeDirection = 'left' | 'right';

interface TouchGestureState {
  startX: number;
  startY: number;
  startTime: number;
  isDragging: boolean;
  cancelled: boolean;
}

interface UseSwipeCardGestureOptions {
  useTouchTunnel: boolean;
  overlayOpen: boolean | undefined;
  showTapHint: boolean;
  x: MotionValue<number>;
  exitOpacity: MotionValue<number>;
  underlayY: MotionValue<number>;
  underlayScale: MotionValue<number>;
  underlayOpacity: MotionValue<number>;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap: () => void;
  onTapTitle: () => void;
  onTapCompany: () => void;
  clearTapHint: () => void;
}

/**
 * All gestlogik för swipe-kortet i EN hook:
 *  - Touch-tunnel (iOS/Android): egen state-machine som skiljer tap/drag/scroll.
 *  - Mouse-drag (desktop): framer-motions inbyggda drag med `handleDragEnd`.
 *  - Explicit `triggerSwipe(direction)` som kan anropas från knappar.
 *
 * VIKTIGT: `x` ägs av containern (JobSlide) eftersom flera transforms
 * (rotate, scale, stamp-opacity) läser från samma MotionValue. Hooken
 * skriver bara till den — den skapar den inte.
 */
export function useSwipeCardGesture({
  useTouchTunnel,
  overlayOpen,
  showTapHint,
  x,
  exitOpacity,
  underlayY,
  underlayScale,
  underlayOpacity,
  onSwipeLeft,
  onSwipeRight,
  onTap,
  onTapTitle,
  onTapCompany,
  clearTapHint,
}: UseSwipeCardGestureOptions) {
  const swipedRef = useRef(false);
  const touchGestureRef = useRef<TouchGestureState | null>(null);
  const lastTapTimestampRef = useRef(0);
  const thresholdHapticFiredRef = useRef(false);
  const overlayClosedAtRef = useRef(0);
  const prevOverlayOpenRef = useRef(overlayOpen);

  useEffect(() => {
    if (prevOverlayOpenRef.current && !overlayOpen) {
      overlayClosedAtRef.current = Date.now();
    }
    prevOverlayOpenRef.current = overlayOpen;
  }, [overlayOpen]);

  const triggerSwipe = useCallback(
    (direction: SwipeDirection) => {
      lastTapTimestampRef.current = 0;
      clearTapHint();
      hapticMedium();

      if (direction === 'right') {
        animate(x, 0, SNAP_SPRING);
        onSwipeRight();
        return;
      }

      swipedRef.current = true;

      // Exit-animation för kortet (kör klart även efter att föräldern
      // har advancerat — motion-instansen lever kvar tills unmount).
      animate(x, -EXIT_X, EXIT_SPRING);
      animate(exitOpacity, 0, {
        duration: EXIT_OPACITY_DURATION,
        ease: PREMIUM_EASE,
      });

      // Underlaget stiger upp bakom det utåkande kortet.
      animate(underlayY, 0, UNDERLAY_RISE_SPRING);
      animate(underlayScale, 1, UNDERLAY_RISE_SPRING);
      animate(underlayOpacity, 1, {
        duration: UNDERLAY_OPACITY_DURATION,
        ease: PREMIUM_EASE,
      });

      // 🚀 Tinder/TikTok-handoff: mounta nästa kort mid-exit istället för
      // att vänta på att springen landar. Underlaget täcker då redan större
      // delen av frame → smidig visuell övergång, ingen väntetid för input.
      window.setTimeout(() => {
        onSwipeLeft();
        swipedRef.current = false;
        x.set(0);
        exitOpacity.set(1);
        underlayY.set(UNDERLAY_INITIAL_Y);
        underlayScale.set(UNDERLAY_INITIAL_SCALE);
        underlayOpacity.set(0);
      }, EXIT_HANDOFF_MS);
    },
    [
      clearTapHint,
      exitOpacity,
      onSwipeLeft,
      onSwipeRight,
      underlayOpacity,
      underlayScale,
      underlayY,
      x,
    ],
  );

  // Mouse-drag (desktop-fallback när touch-tunneln är av).
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (swipedRef.current) return;
      const { offset, velocity } = info;
      const dragDistance = Math.abs(offset.x);
      const dragVelocity = Math.abs(velocity.x);

      if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
        triggerSwipe('right');
        return;
      }
      if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
        triggerSwipe('left');
        return;
      }
      if (dragDistance > TAP_MOVE_THRESHOLD || dragVelocity > TAP_RESET_VELOCITY_THRESHOLD) {
        lastTapTimestampRef.current = 0;
        clearTapHint();
      }
      animate(x, 0, SNAP_SPRING);
    },
    [clearTapHint, triggerSwipe, x],
  );

  const handleTouchStartCapture = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (
        !useTouchTunnel ||
        swipedRef.current ||
        overlayOpen ||
        event.touches.length !== 1 ||
        isWithinTapHintTarget(event.target) ||
        isWithinInteractiveTarget(event.target)
      )
        return;

      // Döda scroll-momentum så kortet "landar" direkt.
      const scrollParent = (event.currentTarget as HTMLElement).closest('[class*="overflow-y"]');
      if (scrollParent) {
        scrollParent.scrollTop = scrollParent.scrollTop;
      }

      const touch = event.touches[0];
      touchGestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isDragging: false,
        cancelled: false,
      };
    },
    [useTouchTunnel, overlayOpen],
  );

  const handleTouchMoveCapture = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (
        !useTouchTunnel ||
        swipedRef.current ||
        event.touches.length !== 1 ||
        isWithinTapHintTarget(event.target) ||
        isWithinInteractiveTarget(event.target)
      )
        return;

      const gesture = touchGestureRef.current;
      if (!gesture || gesture.cancelled) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;

      if (!gesture.isDragging) {
        if (
          Math.abs(deltaX) < TOUCH_DRAG_INTENT_THRESHOLD &&
          Math.abs(deltaY) < TOUCH_DRAG_INTENT_THRESHOLD
        ) {
          return;
        }
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          gesture.cancelled = true;
          lastTapTimestampRef.current = 0;
          clearTapHint();
          return;
        }
        gesture.isDragging = true;
        thresholdHapticFiredRef.current = false;
        lastTapTimestampRef.current = 0;
        clearTapHint();
      }

      if (event.cancelable) event.preventDefault();
      x.set(deltaX);

      if (!thresholdHapticFiredRef.current && Math.abs(deltaX) >= SWIPE_THRESHOLD) {
        thresholdHapticFiredRef.current = true;
        hapticLight();
      }
    },
    [clearTapHint, useTouchTunnel, x],
  );

  const handleTouchEndCapture = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (
        !useTouchTunnel ||
        isWithinTapHintTarget(event.target) ||
        isWithinInteractiveTarget(event.target)
      ) {
        touchGestureRef.current = null;
        return;
      }

      if (overlayOpen || Date.now() - overlayClosedAtRef.current < OVERLAY_CLOSE_INPUT_LOCK_MS) {
        touchGestureRef.current = null;
        return;
      }
      const gesture = touchGestureRef.current;
      touchGestureRef.current = null;

      if (!gesture || swipedRef.current || gesture.cancelled) return;

      const touch = event.changedTouches[0];
      const offsetX = touch.clientX - gesture.startX;
      const offsetY = touch.clientY - gesture.startY;
      const movedDistance = Math.hypot(offsetX, offsetY);
      const pressDuration = Date.now() - gesture.startTime;
      const velocityX = pressDuration > 0 ? (offsetX / pressDuration) * 1000 : 0;

      if (gesture.isDragging) {
        if (offsetX > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD) {
          triggerSwipe('right');
          return;
        }
        if (offsetX < -SWIPE_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
          triggerSwipe('left');
          return;
        }
        animate(x, 0, SNAP_SPRING);
        return;
      }

      if (movedDistance > TAP_MOVE_THRESHOLD || pressDuration > TAP_MAX_DURATION) {
        lastTapTimestampRef.current = 0;
        clearTapHint();
        return;
      }

      const now = Date.now();

      if (showTapHint) {
        clearTapHint();
        lastTapTimestampRef.current = 0;
        return;
      }

      const isTapOnTitle =
        event.target instanceof Element && Boolean(event.target.closest('[data-title-tap-zone]'));
      const isTapOnCompany =
        event.target instanceof Element &&
        Boolean(event.target.closest('[data-company-tap-zone]'));

      if (isTapOnTitle) {
        onTapTitle();
        return;
      }
      if (isTapOnCompany) {
        onTapCompany();
        return;
      }

      if (now - lastTapTimestampRef.current <= DOUBLE_TAP_DELAY) {
        clearTapHint();
        lastTapTimestampRef.current = 0;
        onTap();
        return;
      }

      lastTapTimestampRef.current = 0;
      onTap();
    },
    [
      clearTapHint,
      onTap,
      onTapCompany,
      onTapTitle,
      overlayOpen,
      showTapHint,
      triggerSwipe,
      useTouchTunnel,
      x,
    ],
  );

  const handleTouchCancelCapture = useCallback(() => {
    clearTapHint();
    touchGestureRef.current = null;
    if (!swipedRef.current) {
      animate(x, 0, SNAP_SPRING);
    }
  }, [clearTapHint, x]);

  return {
    triggerSwipe,
    handleDragEnd,
    handleTouchStartCapture,
    handleTouchMoveCapture,
    handleTouchEndCapture,
    handleTouchCancelCapture,
  };
}
