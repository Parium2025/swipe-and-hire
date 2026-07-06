import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Skydd mot tap-through när ett overlay (detail/apply/filter) just stängts.
 *
 * När användaren tappar "Stäng" på en sheet kan samma tap-event bubbla ner
 * till JobSlide och öppna detail-sheeten igen (särskilt på iOS där
 * touchend fires efter att overlayet redan är borta). Lösning: sätt en
 * cooldown-flagga i 520 ms + rendera en osynlig shield-layer som
 * fångar alla pekare under samma fönster.
 */
export function useOverlayCooldown(durationMs = 520) {
  const cooldownActiveRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shieldActive, setShieldActive] = useState(false);

  const startCooldown = useCallback(() => {
    cooldownActiveRef.current = true;
    setShieldActive(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      cooldownActiveRef.current = false;
      setShieldActive(false);
      timerRef.current = null;
    }, durationMs);
  }, [durationMs]);

  const isInCooldown = useCallback(() => cooldownActiveRef.current, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { shieldActive, startCooldown, isInCooldown };
}
