import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type TouchEvent } from 'react';
import { useAnimation, useMotionValue, useTransform } from 'framer-motion';

const DISMISS_THRESHOLD = 100;

/**
 * Delad drag-to-dismiss + entry-animation för bottom sheets (SwipeJobDetail).
 *
 * Ansvar:
 *  - Spring-in vid open, spring-out vid stäng (samma timings som originalet).
 *  - Drag från handle (alltid) eller från topp av innehåll (bara när scrollTop=0).
 *  - Resistance vid nedåt-drag (0.8), snap-back vid liten drag, dismiss vid > 100 px.
 *  - Backdrop-fade drivet av dragY så bakgrunden mattas när man drar.
 *  - Cooldown (420 ms) mot tap-through direkt efter open.
 *  - Städar pending close-timer på unmount.
 *
 * VIKTIGT: spring/duration/threshold är identiska med originalet — får ej
 * ändras utan explicit begäran (100 % visuell paritet krävs).
 */
export function useSheetDragDismiss(open: boolean, onClose: () => void) {
  const dragY = useMotionValue(0);
  const sheetControls = useAnimation();
  const backdropOpacity = useTransform(dragY, [0, 300], [1, 0]);

  const dragStartY = useRef(0);
  const isDraggingSheet = useRef(false);
  const openedAtRef = useRef(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isAnimatingIn, setIsAnimatingIn] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  const animatedClose = useCallback(() => {
    setDismissing(true);
    void sheetControls.start({
      y: '100%',
      transition: { type: 'spring', damping: 34, stiffness: 400, mass: 0.8 },
    });
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      onClose();
      setDismissing(false);
      closeTimerRef.current = null;
    }, 220);
  }, [onClose, sheetControls]);

  const handleBackdropDismiss = useCallback(
    (event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>) => {
      if (Date.now() - openedAtRef.current < 420) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      animatedClose();
    },
    [animatedClose],
  );

  const stopSheetPropagation = useCallback(
    (event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
    },
    [],
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      if (scrollTop <= 0) {
        isDraggingSheet.current = true;
        dragStartY.current = e.touches[0].clientY;
        dragY.set(0);
      }
    },
    [dragY],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (!isDraggingSheet.current) return;
      const dy = e.touches[0].clientY - dragStartY.current;
      if (dy > 0) {
        dragY.set(dy * 0.8);
        e.preventDefault();
      } else {
        isDraggingSheet.current = false;
        dragY.set(0);
      }
    },
    [dragY],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingSheet.current) return;
    isDraggingSheet.current = false;
    const currentY = dragY.get();
    if (currentY > DISMISS_THRESHOLD) {
      setDismissing(true);
      void sheetControls.start({
        y: '100%',
        transition: { type: 'spring', damping: 34, stiffness: 400, mass: 0.8 },
      });
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        onClose();
        setDismissing(false);
        closeTimerRef.current = null;
      }, 220);
    } else {
      dragY.set(0);
      void sheetControls.start({
        y: 0,
        scale: 1,
        opacity: 1,
        transition: { type: 'spring', damping: 24, stiffness: 400 },
      });
    }
  }, [dragY, onClose, sheetControls]);

  const handleHandleTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      isDraggingSheet.current = true;
      dragStartY.current = e.touches[0].clientY;
      dragY.set(0);
      e.stopPropagation();
    },
    [dragY],
  );

  // Entry-animation vid open
  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
      setIsAnimatingIn(true);
      dragY.set(0);
      void sheetControls
        .start({
          y: 0,
          transition: { type: 'spring', damping: 32, stiffness: 340, mass: 0.8 },
        })
        .then(() => setIsAnimatingIn(false));
    }
  }, [open, dragY, sheetControls]);

  // Cleanup pending timer
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return {
    dragY,
    sheetControls,
    backdropOpacity,
    scrollRef,
    isAnimatingIn,
    dismissing,
    animatedClose,
    handleBackdropDismiss,
    stopSheetPropagation,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleHandleTouchStart,
  };
}
