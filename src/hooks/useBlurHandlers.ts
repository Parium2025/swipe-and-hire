import type { MouseEvent, PointerEvent, TouchEvent } from 'react';

const blurActiveElement = () => {
  if (typeof document === 'undefined') return;
  const activeEl = document.activeElement as HTMLElement | null;
  if (activeEl?.blur) activeEl.blur();
};

/**
 * Returns blur handlers to prevent focus ring flash on click.
 * Spread these onto any interactive element: <Button {...blurHandlers}>
 * 
 * This is the standardized pattern used across all dialogs and wizards
 * to ensure consistent "no flash" behavior on buttons and interactive elements.
 */
export function useBlurHandlers() {
  return {
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      e.currentTarget.blur();
      blurActiveElement();
    },
    onMouseUp: (e: MouseEvent<HTMLElement>) => {
      e.currentTarget.blur();
      blurActiveElement();
    },
    // Touch/pointer variants to prevent mobile “double-tap / focus frame” effects
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.currentTarget.blur();
      blurActiveElement();
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      e.currentTarget.blur();
      blurActiveElement();
    },
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      e.currentTarget.blur();
      blurActiveElement();
    },
    onTouchEnd: (e: TouchEvent<HTMLElement>) => {
      e.currentTarget.blur();
      blurActiveElement();
    },
  };
}

/**
 * Standalone blur handler functions for cases where you need
 * to combine with other handlers or use inline.
 */
export const blurOnMouseDown = (e: MouseEvent<HTMLElement>) => {
  e.currentTarget.blur();
  blurActiveElement();
};

export const blurOnMouseUp = (e: MouseEvent<HTMLElement>) => {
  e.currentTarget.blur();
  blurActiveElement();
};
