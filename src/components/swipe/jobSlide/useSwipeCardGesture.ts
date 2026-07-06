import { useCallback, useEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { animate, type MotionValue, type PanInfo } from 'framer-motion';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import {
  DOUBLE_TAP_DELAY,
  EXIT_X,
  SNAP_SPRING,
  SWIPE_THRESHOLD,
  TAP_MAX_DURATION,
  TAP_MOVE_THRESHOLD,
  TAP_RESET_VELOCITY_THRESHOLD,
  TOUCH_DRAG_INTENT_THRESHOLD,
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

      // 🚀 Advance föräldern OMEDELBART så nästa "riktiga" kort monteras
      // i samma frame som exit-animationen startar (Tinder/Hinge-känsla).
      // Underlaget animerar upp i bakgrunden och tas ur DOM när nästa
      // kort tar över — ingen dead zone mellan 400–600 ms längre.
      onSwipeLeft();

      const exitControls = animate(x, -EXIT_X, {
        type: 'spring',
        stiffness: 240,
        damping: 28,
        mass: 0.8,
      });
      animate(exitOpacity, 0, {
        duration: 0.32,
        ease: [0.22, 1, 0.36, 1],
      });

      animate(underlayY, 0, {
        type: 'spring',
        stiffness: 140,
        damping: 22,
        mass: 1.1,
      });
      animate(underlayScale, 1, {
        type: 'spring',
        stiffness: 140,
        damping: 22,
        mass: 1.1,
      });
      animate(underlayOpacity, 1, {
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      });

      // Städa state när exit-animationen faktiskt är klar — tied to spring,
      // inte hårdkodad timeout. Om komponenten unmountas dessförinnan
      // (nästa kort tar över) så avbryts callbacken automatiskt.
      exitControls.then(() => {
        swipedRef.current = false;
        x.set(0);
        exitOpacity.set(1);
        underlayY.set(800);
        underlayScale.set(0.68);
        underlayOpacity.set(0);
      });
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

      if (overlayOpen || Date.now() - overlayClosedAtRef.current < 500) {
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
