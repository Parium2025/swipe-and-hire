/**
 * Kör en navigering FÖRST när sidomenyns stängningsanimation är klar.
 *
 * Tidigare byttes routen mitt i animationen, vilket gav en synlig "blixt"
 * när innehållet bakom drawern hoppade från t.ex. Hem till Mina ansökningar
 * halvvägs in i rörelsen. Genom att vänta ut hela slide-out-kurvan
 * (250ms, samma som i components/ui/sidebar.tsx) ser användaren en lugn,
 * sammanhängande övergång — precis som i iOS.
 */
export const SIDEBAR_CLOSE_MS = 250;

export function navigateAfterSidebarClose(run: () => void, delay = SIDEBAR_CLOSE_MS): () => void {
  if (typeof window === 'undefined') {
    run();
    return () => {};
  }

  const timer = window.setTimeout(run, delay);
  return () => window.clearTimeout(timer);
}
