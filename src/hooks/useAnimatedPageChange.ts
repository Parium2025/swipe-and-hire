import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { flushSync } from 'react-dom';
import { getManagedScrollContainer, readPositions, writePositions } from '@/lib/scrollRestoration';

type RestoreStyles = () => void;

/**
 * En enda sidbytesmotor för alla sidnumrerade listor.
 *
 * Målsidan förbereds och färdigmålas innan rörelsen startar. En tillfällig
 * höjdlåsning läggs dit före React-renderingen, så en kortare nästa sida inte
 * kan klampa scrollTop.
 */
export function useAnimatedPageChange(
  page: number,
  setPage: Dispatch<SetStateAction<number>>,
  preparePage?: (page: number) => Promise<void>,
) {
  const animationFrameRef = useRef<number | null>(null);
  const restoreStylesRef = useRef<RestoreStyles | null>(null);
  const preparingRef = useRef(false);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    restoreStylesRef.current?.();
  }, []);

  return useCallback(async (nextPage: number) => {
    if (nextPage === page || animationFrameRef.current !== null || preparingRef.current) return;

    const container = getManagedScrollContainer();
    preparingRef.current = true;
    container?.setAttribute('data-page-change-active', 'true');
    try {
      await preparePage?.(nextPage);
    } catch {
      // Bildkomponenternas vanliga fallback hanterar en enskild misslyckad bild.
    } finally {
      preparingRef.current = false;
    }

    if (!container || container.scrollTop <= 1) {
      setPage(nextPage);
      if (container) container.scrollTop = 0;
      container?.removeAttribute('data-page-change-active');
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

    // Aktivera den redan bildförberedda målsidan före hissens första frame.
    // Två rAF ger React-layouten och Safari-kompositorn varsin hel bildruta att
    // färdigställa kort, bilder, logotyper och initialer. Under själva hissen
    // ändras därefter inget innehåll alls.
    flushSync(() => setPage(nextPage));
    container.scrollTop = startTop;

    // Är målsidan kortare (t.ex. sista sidan) skulle låset bara vara tom yta
    // i vyn — hissen skulle starta från ett tomt fält. Börja i stället från
    // den lägsta position där målsidans innehåll fyller skärmen.
    const lockHeight = heightLock.offsetHeight;
    const naturalHeight = container.scrollHeight - lockHeight;
    const maxNaturalTop = Math.max(0, naturalHeight - container.clientHeight);
    const animationStartTop = Math.min(startTop, maxNaturalTop);
    if (animationStartTop < startTop) {
      heightLock.style.height = '0px';
    }
    container.scrollTop = animationStartTop;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        container.scrollTop = animationStartTop;
        requestAnimationFrame(() => {
          container.scrollTop = animationStartTop;
          resolve();
        });
      });
    });

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
      container.removeAttribute('data-page-change-active');
      window.dispatchEvent(new Event('parium:page-change-complete'));
    };
    restoreStylesRef.current = restore;

    const durationMs = Math.min(820, Math.max(550, animationStartTop * 0.08));
    const startedAt = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      // Mjuk start och mjukt stopp – hisskänsla, ingen hetsig utskjutning.
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const nextTop = startTop * (1 - eased);
      container.scrollTop = nextTop;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      container.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      restore();
      animationFrameRef.current = null;

      const positions = readPositions();
      positions[window.location.pathname] = { top: 0 };
      writePositions(positions);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [page, preparePage, setPage]);
}