import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { flushSync } from 'react-dom';
import { getManagedScrollContainer, readPositions, writePositions } from '@/lib/scrollRestoration';

type RestoreStyles = () => void;

/**
 * En enda sidbytesmotor för alla sidnumrerade listor.
 *
 * Rörelsen startar innan innehållet byts. En tillfällig höjdlåsning läggs dit
 * före React-renderingen, så en kortare nästa sida inte kan klampa scrollTop.
 */
export function useAnimatedPageChange(
  page: number,
  setPage: Dispatch<SetStateAction<number>>,
) {
  const animationFrameRef = useRef<number | null>(null);
  const restoreStylesRef = useRef<RestoreStyles | null>(null);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    restoreStylesRef.current?.();
  }, []);

  return useCallback((nextPage: number) => {
    if (nextPage === page || animationFrameRef.current !== null) return;

    const container = getManagedScrollContainer();
    if (!container || container.scrollTop <= 1) {
      setPage(nextPage);
      if (container) container.scrollTop = 0;
      return;
    }

    const startTop = container.scrollTop;
    const previousOverflowAnchor = container.style.overflowAnchor;
    const previousScrollBehavior = container.style.scrollBehavior;
    const previousMomentumScrolling = container.style.getPropertyValue('-webkit-overflow-scrolling');

    container.style.overflowAnchor = 'none';
    container.style.scrollBehavior = 'auto';
    container.style.setProperty('-webkit-overflow-scrolling', 'auto');
    // Sidans vanliga grid-animation är avsedd för första besöket. Om den körs
    // när React byter sida tonas hela den nya kortgruppen från opacity 0 precis
    // före landningen, vilket syns som en blixt i Safari. Markera endast det
    // pågående sidbytet så CSS kan stänga av entréanimationen utan att röra
    // hissens timing, easing eller bytespunkt.
    container.dataset.suppressGridEntryAnimation = 'true';

    // Lägg låset före sidbytet. Att räkna ut och lägga till höjd efter render
    // är för sent i Safari: scrollTop har då redan klampats av en kortare sida.
    const heightLock = document.createElement('div');
    heightLock.setAttribute('aria-hidden', 'true');
    heightLock.style.height = `${container.scrollHeight}px`;
    heightLock.style.width = '100%';
    heightLock.style.flexShrink = '0';
    heightLock.style.pointerEvents = 'none';
    container.appendChild(heightLock);

    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      heightLock.remove();
      container.style.overflowAnchor = previousOverflowAnchor;
      container.style.scrollBehavior = previousScrollBehavior;
      if (previousMomentumScrolling) {
        container.style.setProperty('-webkit-overflow-scrolling', previousMomentumScrolling);
      } else {
        container.style.removeProperty('-webkit-overflow-scrolling');
      }
      restoreStylesRef.current = null;
    };
    restoreStylesRef.current = restore;

    const durationMs = Math.min(1150, Math.max(780, startTop * 0.11));
    const startedAt = performance.now();
    // Byt först när hissen nått den gemensamma, stabila zonen nära toppen.
    // Där syns inte korten som skiljer sig i längd mellan sidorna, så samma
    // bytespunkt fungerar utan blinkning i båda riktningarna.
    const swapThreshold = container.clientHeight * 0.65;
    let swapped = false;
    // Tiden som React-renderingen stjäl får inte räknas in i rörelsen, annars
    // hoppar hissen ifatt kurvan med ett synligt ryck efter sidbytet.
    let pausedMs = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - startedAt - pausedMs) / durationMs, 1);
      // Mjuk start och mjukt stopp – hisskänsla, ingen hetsig utskjutning.
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const nextTop = startTop * (1 - eased);
      container.scrollTop = nextTop;

      // Nästa, Föregående och sidnummer använder bokstavligen samma villkor.
      if (!swapped && nextTop <= swapThreshold) {
        swapped = true;
        const swapStartedAt = performance.now();
        flushSync(() => setPage(nextPage));
        pausedMs += performance.now() - swapStartedAt;
        container.scrollTop = nextTop;
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      if (!swapped) flushSync(() => setPage(nextPage));
      container.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      restore();
      animationFrameRef.current = null;

      const positions = readPositions();
      positions[window.location.pathname] = { top: 0 };
      writePositions(positions);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [page, setPage]);
}