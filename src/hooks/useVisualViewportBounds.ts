import { useEffect } from 'react';

/**
 * iOS Safari: en `position: fixed` app-shell mäts mot layout-viewporten, inte
 * mot det som faktiskt syns. När Safari döljer/visar sina verktygsfält kan
 * hela shellen därför hamna ovanför den synliga ytan — toppraden (logga,
 * notiser, profil) klipps bort och kommer inte tillbaka när man scrollar upp,
 * eftersom dokumentet självt inte kan scrolla (body är fixed).
 *
 * Hooken speglar visualViewport till CSS-variabler så shellen alltid kan
 * ankras exakt mot den synliga ytan:
 *   --app-viewport-height  faktisk synlig höjd
 *   --app-viewport-offset  hur långt ned den synliga ytan börjar
 */
export function useVisualViewportBounds() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty('--app-viewport-height', `${Math.round(vv.height)}px`);
      root.style.setProperty('--app-viewport-offset', `${Math.max(0, Math.round(vv.offsetTop))}px`);
    };

    apply();
    // Uppdatera innan nästa paint. En requestAnimationFrame här lämnade exakt
    // en synlig bildruta där Safari redan hade flyttat layout-viewporten vid
    // tangentbordsfokus men appskalet fortfarande använde de gamla måtten.
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.addEventListener('orientationchange', apply);

    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      window.removeEventListener('orientationchange', apply);
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-viewport-offset');
    };
  }, []);
}

export default useVisualViewportBounds;
