import type { MouseEvent } from 'react';

/**
 * Samma struktur som knapparna i "Skapa jobb"-dialogen: fokusringen ska aldrig
 * blixtra till vid musklick (den finns kvar för tangentbordsnavigering).
 */
export const noFocusRingProps = {
  onMouseDown: (e: MouseEvent<HTMLButtonElement>) => e.currentTarget.blur(),
  onMouseUp: (e: MouseEvent<HTMLButtonElement>) => e.currentTarget.blur(),
};
