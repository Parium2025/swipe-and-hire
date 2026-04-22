/**
 * Engångs-tvångsrensning av Service Worker + Cache Storage i produktion.
 *
 * Bakgrund: Tidigare SW-versioner (v1–v7) kunde envisas hos användare som
 * besökt sajten innan vi förbättrade cache-hanteringen. Resultat: vanlig
 * webbläsare visade en gammal bundle medan incognito visade den nya.
 *
 * Den här rutinen körs EN GÅNG per användare (markerat i localStorage) på
 * publicerade domäner och:
 *   1. Av-registrerar alla service workers
 *   2. Tömmer alla Cache Storage-buckets
 *   3. Tvingar en silent reload så nya SW + bundle hämtas direkt
 *
 * Bumpa RESET_VERSION om vi behöver göra det igen i framtiden.
 */

const RESET_VERSION = 'sw-reset-2026-04-22';
const RESET_KEY = 'parium_sw_force_reset';

export function forceServiceWorkerReset(): void {
  try {
    if (typeof window === 'undefined') return;

    const host = window.location.hostname;
    // Endast på publicerade domäner — preview hanteras redan separat i bootstrap
    const isProdDomain =
      host === 'parium.se' ||
      host === 'www.parium.se' ||
      host === 'parium-ab.lovable.app';
    if (!isProdDomain) return;

    const stored = localStorage.getItem(RESET_KEY);
    if (stored === RESET_VERSION) return;

    // Markera direkt så vi inte loopar om reload triggas
    localStorage.setItem(RESET_KEY, RESET_VERSION);

    const tasks: Promise<unknown>[] = [];

    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      tasks.push(
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister().catch(() => false))))
          .catch(() => undefined)
      );
    }

    if (typeof caches !== 'undefined' && caches.keys) {
      tasks.push(
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k).catch(() => false))))
          .catch(() => undefined)
      );
    }

    if (tasks.length === 0) return;

    Promise.all(tasks)
      .then(() => {
        console.log('[swForceReset] Cleared old service worker + caches, reloading…');
        // Liten delay så loggen hinner skrivas och localStorage flush:as
        setTimeout(() => {
          try {
            window.location.reload();
          } catch {
            /* ignore */
          }
        }, 50);
      })
      .catch(() => {
        // Aldrig blockera appstart om städningen misslyckas
      });
  } catch {
    // ignore
  }
}
