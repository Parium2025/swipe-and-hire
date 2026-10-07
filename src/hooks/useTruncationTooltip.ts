import { useCallback, useRef, useState } from 'react';

/**
 * Avgör om en elementets text faktiskt är kapad — horisontellt (`.truncate`)
 * eller vertikalt (`line-clamp-*`). Mätningen är billig och körs först när
 * användaren hovrar, aldrig vid render.
 */
export function isTextTruncated(el: HTMLElement | null): boolean {
  if (!el) return false;

  const styles = window.getComputedStyle(el);
  const clamp = (styles.getPropertyValue('-webkit-line-clamp') || '').trim();
  const hasClamp = clamp !== '' && clamp !== 'none';

  if (hasClamp) {
    // En klamrad ruta visar inte hela innehållet i scrollHeight, så mät tillfälligt
    // utan klamring och jämför höjd. Återställ alltid efteråt.
    const target = el as HTMLElement & { style: CSSStyleDeclaration };
    const originalClamp = (target.style as any).webkitLineClamp;
    const originalDisplay = target.style.display;
    const originalMaxHeight = target.style.maxHeight;
    const originalOverflow = target.style.overflow;

    const visibleHeight = el.clientHeight;
    (target.style as any).webkitLineClamp = 'unset';
    target.style.display = 'block';
    target.style.maxHeight = 'none';
    target.style.overflow = 'visible';

    const naturalHeight = el.scrollHeight;
    let naturalWidth = 0;
    if (clamp === '1') {
      const originalWhiteSpace = target.style.whiteSpace;
      target.style.whiteSpace = 'nowrap';
      naturalWidth = el.scrollWidth;
      target.style.whiteSpace = originalWhiteSpace;
    }

    (target.style as any).webkitLineClamp = originalClamp;
    target.style.display = originalDisplay;
    target.style.maxHeight = originalMaxHeight;
    target.style.overflow = originalOverflow;

    return naturalHeight > visibleHeight + 1 || (clamp === '1' && naturalWidth > el.clientWidth + 1);
  }

  return (
    Math.ceil(el.scrollWidth) > Math.ceil(el.clientWidth) + 1 ||
    Math.ceil(el.scrollHeight) > Math.ceil(el.clientHeight) + 1
  );
}

/**
 * Port som styr en tooltip så att den endast öppnas när texten verkligen är
 * trunkerad. Används tillsammans med `<Tooltip open={open} onOpenChange={...}>`.
 *
 * `extraCheck` används när den kapade texten inte är själva triggern (t.ex. en
 * knapp som innehåller en trunkerad rubrik).
 */
export function useTruncationTooltip<T extends HTMLElement = HTMLElement>(
  extraCheck?: () => boolean,
) {
  const ref = useRef<T>(null);
  const [open, setOpen] = useState(false);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setOpen(false);
        return;
      }
      const truncated = extraCheck ? extraCheck() : isTextTruncated(ref.current);
      setOpen(truncated);
    },
    // extraCheck är en stabil callback hos alla användare
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraCheck],
  );

  return { ref, open, onOpenChange };
}
