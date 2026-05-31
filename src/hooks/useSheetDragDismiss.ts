import { useCallback, useRef, type RefObject, type TouchEvent } from 'react';
import { useMotionValue, type MotionValue } from 'framer-motion';

interface UseSheetDragDismissOptions {
  /** Ref till scroll-containern: drag-dismiss tillåts bara när scrollTop <= 0. */
  scrollRef: RefObject<HTMLElement>;
  /** Px nedåt-drag som triggar dismiss. Default 100. */
  threshold?: number;
  /** Callback som körs när tröskeln passeras vid touchEnd. */
  onDismiss: () => void;
}

/**
 * Delad drag-to-dismiss touch-logik för bottom-sheets.
 * Extraherad från SwipeJobDetail + SwipeFilterSheet som tidigare hade
 * identiska kopior. Returnerar `dragY` (MotionValue att binda till sheet)
 * + touch-handlers för både handle och innehåll.
 *
 * OBS: Endast touch-baserade sheets. SwipeApplySheet använder framer-motions
 * inbyggda drag-prop och rörs inte.
 */
export function useSheetDragDismiss({
  scrollRef,
  threshold = 100,
  onDismiss,
}: UseSheetDragDismissOptions): {
  dragY: MotionValue<number>;
  handleTouchStart: (e: TouchEvent<HTMLDivElement>) => void;
  handleTouchMove: (e: TouchEvent<HTMLDivElement>) => void;
  handleTouchEnd: () => void;
  handleHandleTouchStart: (e: TouchEvent<HTMLDivElement>) => void;
} {
  const dragY = useMotionValue(0);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      isDragging.current = true;
      dragStartY.current = e.touches[0].clientY;
      dragY.set(0);
    }
  }, [dragY, scrollRef]);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) {
      dragY.set(dy * 0.8);
      e.preventDefault();
    } else {
      isDragging.current = false;
      dragY.set(0);
    }
  }, [dragY]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const currentY = dragY.get();
    if (currentY > threshold) {
      onDismiss();
    } else {
      dragY.set(0);
    }
  }, [dragY, onDismiss, threshold]);

  const handleHandleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragY.set(0);
    e.stopPropagation();
  }, [dragY]);

  return { dragY, handleTouchStart, handleTouchMove, handleTouchEnd, handleHandleTouchStart };
}
