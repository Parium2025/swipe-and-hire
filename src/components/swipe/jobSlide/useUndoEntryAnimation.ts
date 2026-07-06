import { useEffect, useRef } from 'react';
import { animate, type MotionValue } from 'framer-motion';

interface UseUndoEntryAnimationOptions {
  isUndoEntry: boolean | undefined;
  x: MotionValue<number>;
  exitOpacity: MotionValue<number>;
  entryScale: MotionValue<number>;
}

/**
 * Mjuk "catch"-animation när ett kort återkommer via Ångra.
 *
 * VIKTIGT: får ENDAST triggas när isUndoEntry går från false → true
 * (dvs precis efter ett klick på Ångra). Annars kunde animationen "läcka"
 * till nästa kort efter en dislike, eller spelas om när användaren
 * scrollade mellan kort inom 700 ms-fönstret (isActive ändras → effekt
 * re-fyrade). Vi håller därför en ref med föregående värde istället för
 * att bara läsa isUndoEntry i deps.
 */
export function useUndoEntryAnimation({
  isUndoEntry,
  x,
  exitOpacity,
  entryScale,
}: UseUndoEntryAnimationOptions) {
  const prevIsUndoEntryRef = useRef(false);

  useEffect(() => {
    if (isUndoEntry && !prevIsUndoEntryRef.current) {
      x.set(0);
      exitOpacity.set(0.4);
      entryScale.set(0.92);
      animate(exitOpacity, 1, { duration: 0.32, ease: [0.22, 1, 0.36, 1] });
      animate(entryScale, 1, {
        type: 'spring',
        stiffness: 320,
        damping: 26,
        mass: 0.7,
      });
    }
    prevIsUndoEntryRef.current = isUndoEntry ?? false;
  }, [isUndoEntry, x, exitOpacity, entryScale]);
}
