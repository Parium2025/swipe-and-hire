import type { MouseEvent, TouchEvent } from 'react';

/**
 * Exakt samma interaktionsstruktur som de fungerande knapparna i dialogerna:
 * stoppa pekfokus innan det appliceras och rensa föregående aktivt element.
 */
export const noFocusRingProps = {
  onMouseDown: (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const active = document.activeElement as HTMLElement | null;
    if (active?.blur) active.blur();
  },
  onTouchStart: (_e: TouchEvent<HTMLElement>) => {
    const active = document.activeElement as HTMLElement | null;
    if (active?.blur) active.blur();
  },
};
