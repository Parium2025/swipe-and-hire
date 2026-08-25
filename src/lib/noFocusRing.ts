import type { MouseEvent } from 'react';

/**
 * Samma struktur som knapparna i "Skapa jobb"-dialogen: fokusringen ska aldrig
 * blixtra till vid musklick (den finns kvar för tangentbordsnavigering).
 */
export const noFocusRingProps = {
  onMouseDown: (e: MouseEvent<HTMLElement>) => {
    e.currentTarget.blur();
    const active = document.activeElement as HTMLElement | null;
    if (active?.blur) active.blur();
  },
  onMouseUp: (e: MouseEvent<HTMLElement>) => e.currentTarget.blur(),
};

/**
 * Stabiliserar kompositeringen (egen GPU-layer) så att glas-knappar inte
 * "blixtrar till" när fokus lämnar dem vid klick utanför. Ingen visuell skillnad.
 */
export const noFlashButtonClass =
  '[transform:translateZ(0)] [backface-visibility:hidden] [will-change:transform] isolate outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent]';
