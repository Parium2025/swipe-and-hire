import { useCallback, useEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { animate, useReducedMotion, type MotionValue, type PanInfo } from 'framer-motion';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import {
  EXIT_HANDOFF_MS,
  REDUCED_EXIT_HANDOFF_MS,
  REDUCED_FADE,
  REDUCED_SNAP,
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
  const exitHandoffTimerRef = useRef<number | null>(null);

  // 🧹 Fix 2: rensa ev. pending exit-handoff timer om komponenten unmountas
  // mid-exit (t.ex. snabb navigering bort från swipe-vyn). Annars kör
  // callbacken mot en stale closure och kan trigga onSwipeLeft/state-set
  // på en död komponent.
  useEffect(() => {
    return () => {
      if (exitHandoffTimerRef.current !== null) {
        window.clearTimeout(exitHandoffTimerRef.current);
        exitHandoffTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (prevOverlayOpenRef.current && !overlayOpen) {
      overlayClosedAtRef.current = Date.now();
    }
    prevOverlayOpenRef.current = overlayOpen;
  }, [overlayOpen]);

  // ♿️ Respektera systemets "Minska rörelse". Då byter vi spring/parallax mot
  // korta linjära toningar och kortare handoff — samma flöde, ingen sväng.
  const prefersReducedMotion = useReducedMotion();

  const triggerSwipe = useCallback(
    // Andra argumentet (velocity) behålls i signaturen för bakåtkompat med
    // anroparna, men används INTE längre — vi kör alltid den mjuka
    // premium-exit som tidigare (velocity-driven kändes hetsig/inte premium).
    (direction: SwipeDirection, _velocityX?: number) => {
      if (swipedRef.current) return;

      lastTapTimestampRef.current = 0;
      clearTapHint();
      hapticMedium();

      if (direction === 'right') {
        animate(x, 0, prefersReducedMotion ? REDUCED_SNAP : SNAP_SPRING);
        onSwipeRight();
        return;
      }

      swipedRef.current = true;

      // Exit-animation för kortet — mjuk, förutsägbar, alltid samma känsla
      // oavsett hur snabbt användaren swipear. Detta är den ursprungliga
      // premium-exiten före velocity-experimentet.
      // ♿️ Reduced motion: ingen spring/överslag — kortet tonar bort på plats
      // istället för att kastas ut i sidled.
      if (prefersReducedMotion) {
        animate(exitOpacity, 0, { duration: REDUCED_FADE, ease: 'linear' });
        underlayY.set(0);
        underlayScale.set(1);
        animate(underlayOpacity, 1, { duration: REDUCED_FADE, ease: 'linear' });
      } else {
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
      }


      // 🚀 Tinder/TikTok-handoff: mounta nästa kort mid-exit istället för
      // att vänta på att springen landar. Timer trackas i ref → cleanup vid
      // unmount + skrivs över om ny swipe triggas innan förra hunnit landa.
      //
      // ⚠️ VIKTIGT: Vi RESETTAR INTE motion values (x/opacity/underlay) här.
      // Eftersom parent tar bort jobbet från arrayen och `key={job.id}`
      // används i föräldern kommer denna JobSlide-instans att unmountas
      // direkt efter `onSwipeLeft()`. Om vi skriver `x.set(0)` +
      // `exitOpacity.set(1)` synkront går de rakt in i DOM:en (framer-motions
      // imperative-path), medan React-re-rendern med unmount sker i nästa
      // microtask. På långsammare enheter hinner browsern paint:a en frame
      // där det utgående kortet är tillbaka i mitten OCH opaque OCH
      // underlaget är osynligt → man ser den nakna mörkblå card-basen som
      // ett "tomt kort" mellan reject och nästa kort. Låt unmount göra
      // rensningen — inga sets krävs på en instans som ändå försvinner.
      if (exitHandoffTimerRef.current !== null) {
        window.clearTimeout(exitHandoffTimerRef.current);
      }
      exitHandoffTimerRef.current = window.setTimeout(
        () => {
          exitHandoffTimerRef.current = null;
          onSwipeLeft();
        },
        prefersReducedMotion ? REDUCED_EXIT_HANDOFF_MS : EXIT_HANDOFF_MS,
      );

    },
    [
      clearTapHint,
      exitOpacity,
      onSwipeLeft,
      onSwipeRight,
      prefersReducedMotion,
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
        triggerSwipe('right', velocity.x);
        return;
      }
      if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
        triggerSwipe('left', velocity.x);
        return;
      }
      if (dragDistance > TAP_MOVE_THRESHOLD || dragVelocity > TAP_RESET_VELOCITY_THRESHOLD) {
        lastTapTimestampRef.current = 0;
        clearTapHint();
      }
      animate(x, 0, prefersReducedMotion ? REDUCED_SNAP : SNAP_SPRING);
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
          triggerSwipe('right', velocityX);
          return;
        }
        if (offsetX < -SWIPE_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
          triggerSwipe('left', velocityX);
          return;
        }
        animate(x, 0, prefersReducedMotion ? REDUCED_SNAP : SNAP_SPRING);
        return;
      }

      if (movedDistance > TAP_MOVE_THRESHOLD || pressDuration > TAP_MAX_DURATION) {
        lastTapTimestampRef.current = 0;
        clearTapHint();
        return;
      }

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

      // ℹ️ Tap öppnar INTE längre jobbdetaljer — hela infon visas när man
      // swipar höger (gillar). Ett rent tap är därför en no-op.
      lastTapTimestampRef.current = 0;
    },
    [
      clearTapHint,
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
      animate(x, 0, prefersReducedMotion ? REDUCED_SNAP : SNAP_SPRING);
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
