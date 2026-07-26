import { useEffect, useRef } from 'react';
import { animate, useReducedMotion, type MotionValue } from 'framer-motion';

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
  // ♿️ Respektera "Minska rörelse": ingen scale-pop, bara en kort toning.
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (isUndoEntry && !prevIsUndoEntryRef.current) {
      prevIsUndoEntryRef.current = true;
      x.set(0);
      exitOpacity.set(prefersReducedMotion ? 0.6 : 0.4);
      entryScale.set(prefersReducedMotion ? 1 : 0.92);
      const a1 = animate(
        exitOpacity,
        1,
        prefersReducedMotion
          ? { duration: 0.14, ease: 'linear' }
          : { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
      );
      const a2 = animate(
        entryScale,
        1,
        prefersReducedMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 320, damping: 26, mass: 0.7 },
      );
      // 🛟 Säkerhet: om isUndoEntry rensas (700ms-timern), komponenten
      // unmountas, eller effekten körs om innan animationerna landat —
      // stoppa dem OCH tvinga vilovärdena. Utan detta kunde kortet
      // fastna vid entryScale=0.92 / exitOpacity=0.4 och se "hopkrympt" ut.
      return () => {
        a1.stop();
        a2.stop();
        exitOpacity.set(1);
        entryScale.set(1);
      };
    }
    prevIsUndoEntryRef.current = isUndoEntry ?? false;
  }, [isUndoEntry, x, exitOpacity, entryScale, prefersReducedMotion]);
}
