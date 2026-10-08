/**
 * Markerar när appen senast "vaknade": vid sidladdning och när fliken/appen
 * blir synlig igen efter att ha varit dold en stund. Data som hämtats före
 * den tidpunkten kan vara inaktuell (realtime kan ha legat nere i bakgrunden)
 * och får inte visas som första bild i vyer som kräver live-korrekthet.
 */
const RESUME_AFTER_HIDDEN_MS = 30_000;
export const APP_RESUME_EVENT = 'parium:app-resume';

let lastResumeAt = typeof performance !== 'undefined' && performance.timeOrigin
  ? Math.round(performance.timeOrigin)
  : Date.now();
let hiddenAt: number | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt !== null && Date.now() - hiddenAt >= RESUME_AFTER_HIDDEN_MS) {
      lastResumeAt = Date.now();
      window.dispatchEvent(new Event(APP_RESUME_EVENT));
    }
    hiddenAt = null;
  });
}

export const getLastResumeAt = () => lastResumeAt;

/** Sant när data hämtades efter senaste uppvaknandet. */
export const isFetchedSinceResume = (updatedAt: number | undefined | null) =>
  typeof updatedAt === 'number' && updatedAt > 0 && updatedAt >= lastResumeAt;
