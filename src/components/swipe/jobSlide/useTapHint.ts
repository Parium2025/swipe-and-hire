import { useCallback, useEffect, useRef, useState } from 'react';

export type TapHintSource = 'title' | 'company' | null;

interface UseTapHintOptions {
  /** När overlayet öppnas ska hintet stängas direkt. */
  overlayOpen: boolean | undefined;
  /** Titel-elementet — används för att avgöra om texten är avklippt. */
  titleRef: React.RefObject<HTMLElement>;
}

/**
 * Encapsulerar tap-hint-logiken (visa/dölj + auto-hide-timer för title).
 *
 * Företags-hint har ingen auto-hide (visas tills nästa gest), title-hint
 * auto-hides efter 1800 ms endast om title INTE är avklippt — annars
 * behåller vi hintet så att användaren kan scrolla i den fulla titeln.
 */
export function useTapHint({ overlayOpen, titleRef }: UseTapHintOptions) {
  const [showTapHint, setShowTapHint] = useState(false);
  const [tapHintSource, setTapHintSource] = useState<TapHintSource>(null);
  const tapHintTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isTitleTruncated = useCallback(() => {
    const el = titleRef.current;
    if (!el) return false;
    return el.scrollHeight > el.clientHeight + 1;
  }, [titleRef]);

  const clearTapHint = useCallback(() => {
    setShowTapHint(false);
    setTapHintSource(null);
    if (tapHintTimerRef.current) clearTimeout(tapHintTimerRef.current);
  }, []);

  const armTapHint = useCallback(
    (source: 'title' | 'company') => {
      clearTapHint();
      setShowTapHint(true);
      setTapHintSource(source);
      if (source === 'title' && !isTitleTruncated()) {
        tapHintTimerRef.current = setTimeout(() => setShowTapHint(false), 1800);
      }
    },
    [clearTapHint, isTitleTruncated],
  );

  useEffect(() => {
    if (overlayOpen) clearTapHint();
  }, [overlayOpen, clearTapHint]);

  // Städa timer vid unmount så vi inte sätter state på avmonterad komponent.
  useEffect(() => {
    return () => {
      if (tapHintTimerRef.current) clearTimeout(tapHintTimerRef.current);
    };
  }, []);

  return {
    showTapHint,
    tapHintSource,
    isTitleTruncated,
    armTapHint,
    clearTapHint,
  };
}
