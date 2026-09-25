import { useEffect } from 'react';

/**
 * iOS Safari: en `position: fixed` app-shell mäts mot layout-viewporten, inte
 * mot det som faktiskt syns. När Safari döljer/visar sina verktygsfält kan
 * hela shellen därför hamna ovanför den synliga ytan — toppraden (logga,
 * notiser, profil) klipps bort och kommer inte tillbaka när man scrollar upp,
 * eftersom dokumentet självt inte kan scrolla (body är fixed).
 *
 * Appskalet ska INTE storleksändras till visualViewport när tangentbordet
 * öppnas. På iOS är verktygsfälten transparenta och ligger ovanpå samma
 * visualViewport; en krympt fixed-shell lämnar därför ett stort tomt fält.
 * Vi använder i stället visualViewport enbart för att hålla det fokuserade
 * fältet inom den faktiskt synliga delen av skalets egen scrollcontainer.
 */
export function useVisualViewportBounds() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const layoutViewportHeight = () => Math.max(window.innerHeight, root.clientHeight);
    let revealFrame = 0;
    let revealTimer = 0;
    let lastRevealed: Element | null = null;

    const revealFocusedField = () => {
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(revealTimer);
      revealFrame = window.requestAnimationFrame(() => {
        revealTimer = window.setTimeout(() => {
          const active = document.activeElement;
          if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement)) return;

          const viewportTop = Math.max(0, vv.offsetTop) + 12;
          const viewportBottom = Math.max(viewportTop, vv.offsetTop + vv.height - 12);
          const rect = active.getBoundingClientRect();
          const delta = rect.bottom > viewportBottom
            ? rect.bottom - viewportBottom
            : rect.top < viewportTop
              ? rect.top - viewportTop
              : 0;

          if (Math.abs(delta) < 1) return;
          let parent = active.parentElement;
          while (parent) {
            const style = window.getComputedStyle(parent);
            if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) {
              parent.scrollBy({ top: delta, behavior: 'instant' });
              return;
            }
            parent = parent.parentElement;
          }
        }, 80);
      });
    };

    const apply = () => {
      const keyboardOpen = layoutViewportHeight() - vv.height > 150;
      root.dataset.keyboardOpen = keyboardOpen ? 'true' : 'false';
      root.style.setProperty(
        '--keyboard-occlusion-height',
        `${Math.max(0, Math.round(layoutViewportHeight() - vv.height - vv.offsetTop))}px`
      );
      const active = document.activeElement;
      if (keyboardOpen && active !== lastRevealed) {
        lastRevealed = active;
        revealFocusedField();
      }
      if (!keyboardOpen) lastRevealed = null;
    };

    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.addEventListener('orientationchange', apply);
    window.addEventListener('focusin', revealFocusedField);

    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('focusin', revealFocusedField);
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(revealTimer);
      root.style.removeProperty('--keyboard-occlusion-height');
      delete root.dataset.keyboardOpen;
    };
  }, []);
}

export default useVisualViewportBounds;
