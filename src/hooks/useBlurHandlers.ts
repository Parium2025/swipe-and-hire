import type { MouseEvent } from 'react';

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
    },
    onMouseUp: (e: MouseEvent<HTMLElement>) => {
      e.currentTarget.blur();
    },
  };
}

/**
 * Standalone blur handler functions for cases where you need
 * to combine with other handlers or use inline.
 */
export const blurOnMouseDown = (e: MouseEvent<HTMLElement>) => {
  e.currentTarget.blur();
};

export const blurOnMouseUp = (e: MouseEvent<HTMLElement>) => {
  e.currentTarget.blur();
};
