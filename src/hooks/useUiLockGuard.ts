import { useEffect } from 'react';

/**
 * Global skyddsnät mot "låst UI".
 *
 * Radix (Dialog/DropdownMenu/Select/Popover i modal-läge) sätter
 * `document.body.style.pointer-events = 'none'` medan ett modalt lager är
 * öppet, och återställer det när lagret stängs. Om ett lager avmonteras i
 * samma tick som det stängs (t.ex. när en dropdown-item stänger både menyn
 * och dialogen den ligger i) hinner städningen aldrig köras — då blir hela
 * sidan oklickbar tills man laddar om.
 *
 * Den här vakten observerar body-attribut och rensar spärren så fort det inte
 * finns något faktiskt öppet modalt lager kvar i DOM:en. Den rör aldrig
 * spärren medan en riktig dialog/meny är öppen.
 */

const OPEN_LAYER_SELECTOR = [
  '[data-radix-popper-content-wrapper]',
  '[data-state="open"][role="dialog"]',
  '[data-state="open"][role="alertdialog"]',
  '[data-state="open"][role="menu"]',
  '[data-state="open"][role="listbox"]',
  '[data-state="open"][data-parium="dialog-content"]',
].join(',');

function hasVisibleOpenLayer(): boolean {
  const nodes = document.querySelectorAll<HTMLElement>(OPEN_LAYER_SELECTOR);
  for (const node of nodes) {
    // Projektet döljer förvarmade dialoger med display:none — de räknas inte.
    if (node.offsetParent !== null || node.getClientRects().length > 0) return true;
  }
  return false;
}

function releaseIfStuck() {
  const body = document.body;
  if (!body) return;
  if (body.style.pointerEvents !== 'none') return;
  if (hasVisibleOpenLayer()) return;
  body.style.removeProperty('pointer-events');
}

export function useUiLockGuard() {
  useEffect(() => {
    // Kör direkt vid montering (t.ex. efter en HMR/route-växling).
    releaseIfStuck();

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      // Två frames: låt Radix hinna montera/avmontera sina lager först.
      raf = requestAnimationFrame(() => requestAnimationFrame(releaseIfStuck));
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style'],
    });
    observer.observe(document.body, {
      childList: true,
      subtree: false,
    });

    // Extra säkerhet: om användaren klickar och inget händer, kolla igen.
    const onPointerDown = () => schedule();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('focus', schedule);

    const interval = window.setInterval(releaseIfStuck, 1000);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('focus', schedule);
    };
  }, []);
}
