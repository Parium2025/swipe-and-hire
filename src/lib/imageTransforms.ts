/**
 * Centraliserade bild-transforms + device/connection-helpers.
 *
 * Detta är ENDA SANNINGEN för transform-storlekar. Tidigare var samma
 * konstanter duplicerade i 5 filer (SearchJobs, JobView, JobViewHero,
 * useGlobalImagePreloader, useSwipeImagePreloader) — en värdesändring på
 * ett ställe gjorde att cache-keys gick isär och bilder laddades om
 * synligt (höger-till-vänster-fenomen). Importera härifrån istället.
 */

export interface ImageTransform {
  width: number;
  height: number;
  quality: number;
  resize: 'cover' | 'contain' | 'fill';
}

// Card thumbnail (jobblista, swipe-kort baksida etc.)
export const JOB_CARD_TRANSFORM: ImageTransform = {
  width: 600,
  height: 400,
  quality: 75,
  resize: 'cover',
};

// Hero/detaljsida — MÅSTE matcha byte-för-byte mellan card-preload,
// background-warmer, swipe-preload och själva <img> i JobViewHero,
// annars stämmer inte cache-key och bilden laddas synligt.
export const JOB_VIEW_HERO_TRANSFORM: ImageTransform = {
  width: 1200,
  height: 800,
  quality: 75,
  resize: 'cover',
};

// Företagslogo (alla ytor)
export const COMPANY_LOGO_TRANSFORM: ImageTransform = {
  width: 128,
  height: 128,
  quality: 80,
  resize: 'contain',
};

// ─────────────────────────────────────────────────────────────────────────────
// Connection / device awareness — skydd mot onödig data- och minnesförbrukning.
// ─────────────────────────────────────────────────────────────────────────────

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: '2g' | 'slow-2g' | '3g' | '4g';
}

/**
 * True om användaren har Save-Data på eller är på 2G/slow-2G.
 * Används för att hoppa över bakgrunds-preloading och spara mobildata.
 */
export function isSlowOrMeteredConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn =
    (navigator as any).connection ??
    (navigator as any).mozConnection ??
    (navigator as any).webkitConnection;
  if (!conn) return false;
  const c = conn as NetworkInformationLike;
  if (c.saveData === true) return true;
  if (c.effectiveType === '2g' || c.effectiveType === 'slow-2g') return true;
  return false;
}

/**
 * Returnerar ungefärligt RAM i GB (Chrome/Android). Safari/iOS rapporterar
 * inte detta → returnerar undefined, då antar vi normal mid-tier device.
 */
export function getDeviceMemoryGB(): number | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const m = (navigator as any).deviceMemory;
  return typeof m === 'number' ? m : undefined;
}

/**
 * Rekommenderat max antal entries i in-memory blob-cache baserat på enhet.
 * Låg-RAM-enheter (≤3 GB → iPhone SE/8, äldre Android) får mindre cache
 * för att undvika tab-krascher i Safari.
 */
export function getRecommendedCacheEntries(): number {
  const gb = getDeviceMemoryGB();
  if (gb !== undefined && gb <= 3) return 500;
  return 1500;
}
