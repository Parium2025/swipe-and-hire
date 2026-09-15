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

    const durationMs = Math.min(1050, Math.max(700, startTop * 0.1));
    const startedAt = performance.now();
    const swapThreshold = container.clientHeight * 1.25;
    let frame = 0;
    let swapped = false;

    const animate = (now: number) => {
      frame += 1;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextTop = startTop * (1 - eased);
      container.scrollTop = nextTop;

      // Minst en målad rörelsebild före bytet. Därefter byts korten utanför
      // synfältet, med exakt samma ordning oavsett riktning eller sidnummer.
      if (!swapped && frame >= 2 && nextTop > swapThreshold) {
        swapped = true;
        flushSync(() => setPage(nextPage));
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