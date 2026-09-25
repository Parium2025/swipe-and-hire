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
 * visualViewport används bara för att känna av tangentbordets tillstånd. Safari
 * äger själv placeringen av fokuserade fält; en extra programmatisk scroll här
 * konkurrerar med webbläsaren och ger ett andra, fördröjt hopp.
 */
export function useVisualViewportBounds() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const layoutViewportHeight = () => Math.max(window.innerHeight, root.clientHeight);
    let closeTimer = 0;
    let wasKeyboardOpen = false;

    const applyNow = () => {
      const keyboardOpen = layoutViewportHeight() - vv.height > 150;
      const active = document.activeElement;

      // iOS kan fälla ned tangentbordet utan att släppa DOM-fokus. Då räcker
      // nästa fingerkontakt i samma textarea för att öppna tangentbordet igen,
      // även när användaren egentligen påbörjar en vanlig scrollgest. Avsluta
      // det kvarhängande fokuset först när en verklig öppen→stängd övergång
      // har observerats; vanliga tryck och byte mellan fält påverkas inte.
      if (
        wasKeyboardOpen
        && !keyboardOpen
        && (active instanceof HTMLInputElement
          || active instanceof HTMLTextAreaElement
          || active instanceof HTMLSelectElement)
      ) {
        active.blur();
      }
      wasKeyboardOpen = keyboardOpen;

      root.dataset.keyboardOpen = keyboardOpen ? 'true' : 'false';
      root.style.setProperty(
        '--keyboard-viewport-offset',
        keyboardOpen ? `${Math.max(0, Math.round(vv.offsetTop))}px` : '0px'
      );
      root.style.setProperty(
        '--keyboard-occlusion-height',
        `${Math.max(0, Math.round(layoutViewportHeight() - vv.height - vv.offsetTop))}px`
      );
    };

    const apply = applyNow;

    const handleFocusOut = () => {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(apply, 180);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') apply();
    };

    applyNow();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.addEventListener('orientationchange', apply);
    window.addEventListener('focusout', handleFocusOut);
    window.addEventListener('pageshow', apply);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('pageshow', apply);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearTimeout(closeTimer);
      root.style.removeProperty('--keyboard-occlusion-height');
      root.style.removeProperty('--keyboard-viewport-offset');
      delete root.dataset.keyboardOpen;
    };
  }, []);
}

export default useVisualViewportBounds;
