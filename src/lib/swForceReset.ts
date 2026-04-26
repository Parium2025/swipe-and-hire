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
 *   3. Tvingar en silent reload så bundle hämtas direkt utan SW
 *
 * Bumpa RESET_VERSION om vi behöver göra det igen i framtiden.
 */

const RESET_VERSION = 'sw-reset-2026-04-26-v9-hard-domain-no-sw-no-cache';
const RESET_KEY = 'parium_sw_force_reset';
const RESET_ATTEMPT_KEY = 'parium_sw_force_reset_attempt';
const RESET_QUERY_PARAM = '_sw_reset';
const ATTEMPT_TTL_MS = 30_000;

export const getServiceWorkerResetVersion = (): string => RESET_VERSION;

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

    const url = new URL(window.location.href);
    const resetMarkerInUrl = url.searchParams.get(RESET_QUERY_PARAM);
    const stored = localStorage.getItem(RESET_KEY);

    if (resetMarkerInUrl === RESET_VERSION) {
      localStorage.setItem(RESET_KEY, RESET_VERSION);
      sessionStorage.removeItem(RESET_ATTEMPT_KEY);
      url.searchParams.delete(RESET_QUERY_PARAM);
      window.history.replaceState({}, document.title, url.toString());
      return;
    }

    const hasServiceWorkerApi = 'serviceWorker' in navigator && !!navigator.serviceWorker.getRegistrations;

    const runReset = async (): Promise<void> => {
      const tasks: Promise<unknown>[] = [];

      if (hasServiceWorkerApi) {
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

      await Promise.all(tasks);
    };

    const verifyClean = async (): Promise<boolean> => {
      try {
        const [regs, keys] = await Promise.all([
          hasServiceWorkerApi ? navigator.serviceWorker.getRegistrations().catch(() => []) : Promise.resolve([]),
          typeof caches !== 'undefined' && caches.keys ? caches.keys().catch(() => []) : Promise.resolve([]),
        ]);
        return regs.length === 0 && keys.length === 0 && !navigator.serviceWorker?.controller;
      } catch {
        return false;
      }
    };

    if (stored === RESET_VERSION && !navigator.serviceWorker?.controller) {
      void verifyClean().then((clean) => {
        if (clean) return;
        localStorage.removeItem(RESET_KEY);
        void runReset();
      });
      return;
    }

    const lastAttemptRaw = sessionStorage.getItem(RESET_ATTEMPT_KEY);
    if (lastAttemptRaw) {
      const [attemptVersion, attemptTsRaw] = lastAttemptRaw.split(':');
      const attemptTs = Number(attemptTsRaw);
      if (
        attemptVersion === RESET_VERSION &&
        Number.isFinite(attemptTs) &&
        Date.now() - attemptTs < ATTEMPT_TTL_MS
      ) {
        return;
      }
    }

    sessionStorage.setItem(RESET_ATTEMPT_KEY, `${RESET_VERSION}:${Date.now()}`);

    runReset()
      .then(() => {
        console.log('[swForceReset] Removed service worker + caches, reloading…');
        setTimeout(() => {
          try {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set(RESET_QUERY_PARAM, RESET_VERSION);
            window.location.replace(nextUrl.toString());
          } catch {
            /* ignore */
          }
        }, 50);
      })
      .catch(() => {
        sessionStorage.removeItem(RESET_ATTEMPT_KEY);
      });
  } catch {
    // ignore
  }
}
