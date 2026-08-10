/**
 * ENDA sanningskällan för hero-videons källval.
 *
 * Både `index.html` (preload-scriptet) och `HeroVideo.tsx` måste välja EXAKT
 * samma URL. Om de går isär hämtar browsern två filer (25 MB + 6,6 MB) och
 * spelar bara den ena — vilket är det dyraste felet vi kan göra på LCP.
 *
 * Reglerna nedan är därför formulerade en gång och konsumeras av båda:
 *  - React-sidan importerar `pickHeroSrc()` direkt.
 *  - index.html speglar samma villkor i vanilla JS och verifieras vid build av
 *    `scripts/verify-hero-preload.ts`, som failar bygget vid minsta avvikelse.
 */
import hero4k from '@/assets/hero-video-v9.mp4.asset.json';
import hero1440 from '@/assets/hero-video-1440-v9.mp4.asset.json';
import hero1080 from '@/assets/hero-video-1080-v9.mp4.asset.json';

/** 4K-master (CDN). Endast riktiga desktops med bra nät och hårdvaruavkodning. */
export const HERO_VIDEO_4K = hero4k.url;

/** 1440p-master (CDN). Kraftfulla Windows/Android-enheter på stor skärm. */
export const HERO_VIDEO_1440 = hero1440.url;

/** 1080p-master (CDN). Svagare enheter, mobil, sparläge, svagt nät. */
export const HERO_VIDEO_1080 = hero1080.url;

/** Poster = LCP-kandidat på landningssidan. */
export const HERO_POSTER = '/hero-video-poster-v8.jpg';

/** Breakpointen som skiljer 4K från 1080p. Speglad i index.html. */
export const HERO_DESKTOP_QUERY = '(min-width: 1024px)';

type Conn = { saveData?: boolean; effectiveType?: string } | undefined;

const connection = (): Conn => {
  if (typeof navigator === 'undefined') return undefined;
  const n = navigator as unknown as Record<string, Conn>;
  return n.connection || n.mozConnection || n.webkitConnection;
};

/**
 * Datasparläge eller 2G → hoppa över videoladdning helt och visa bara poster.
 * Sparar 6,6–25 MB för användare i dåligt nät utan att förändra UX synbart.
 */
export const shouldSkipHeroVideo = (): boolean => {
  const c = connection();
  if (!c) return false;
  if (c.saveData) return true;
  return typeof c.effectiveType === 'string' && /(^|-)2g$/.test(c.effectiveType);
};

/** Sparläge eller svagt nät → aldrig 4K. */
const reducedData = (): boolean => {
  const c = connection();
  if (!c) return false;
  return Boolean(c.saveData) || /^(slow-2g|2g|3g)$/.test(c.effectiveType ?? '');
};

/** Windows/Android har varierande decode-budget → aldrig 4K-mastern. */
const lightweightPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Windows NT|Android/i.test(navigator.userAgent || '');

/**
 * Har enheten muskler nog för 1440p? Vi kräver flera kärnor och rimligt RAM.
 * Saknas signalerna (Safari rapporterar dem inte) svarar vi nej — 1080p är
 * alltid det säkra valet, och Apple-enheter går ändå 4K-vägen ovan.
 */
export const HERO_MIN_CORES = 4;
export const HERO_MIN_MEMORY_GB = 4;
const capableForQuadHd = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { deviceMemory?: number };
  const cores = n.hardwareConcurrency ?? 0;
  const memory = n.deviceMemory ?? 0;
  return cores >= HERO_MIN_CORES && memory >= HERO_MIN_MEMORY_GB;
};

/** Välj EXAKT en källa — aldrig flera <source> med `media`, Chrome respekterar det inte. */
export const pickHeroSrc = (): string => {
  if (typeof window === 'undefined') return HERO_VIDEO_1080;
  const desktop =
    typeof window.matchMedia === 'function' && window.matchMedia(HERO_DESKTOP_QUERY).matches;
  if (!desktop || reducedData()) return HERO_VIDEO_1080;
  if (!lightweightPlatform()) return HERO_VIDEO_4K;
  return capableForQuadHd() ? HERO_VIDEO_1440 : HERO_VIDEO_1080;
};

/** Användaren har bett systemet om mindre rörelse → visa stillbild, inte film. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scenfokus för hero-mastern (v9).
 *
 * Videon är 16:9. På en porträttskärm (mobil) fyller `object-cover` höjden och
 * beskär bredden hårt — bara ~25 % av bildbredden syns. Med default `center`
 * hamnar utsnittet mitt i bilden, vilket kapar personer som står till vänster
 * eller höger i sin scen (byggarbetaren och kontorskillen framför allt).
 *
 * `x` är motivets horisontella läge i bilden (0–1). Komponenten räknar om det
 * till `object-position` utifrån hur hårt just den skärmen beskär, så motivet
 * hamnar mitt i bild oavsett telefonformat.
 * `t` är klippets starttid i sekunder i den sammanklippta mastern.
 */
export type HeroFocusPoint = { t: number; x: number };

export const HERO_FOCUS_POINTS: HeroFocusPoint[] = [
  { t: 0, x: 0.25 },     // byggarbetare — står till vänster
  { t: 3.75, x: 0.61 },  // läkare i korridor — höger om mitten
  { t: 7.25, x: 0.55 },  // lagermedarbetarna — paret strax höger om mitten
  { t: 10.15, x: 0.5 },  // kontor — mannen är centrerad i den nya scenen
  { t: 13.59, x: 0.5 },  // kvinna utomhus — centrerad
];

/** Sekunder som fokuspunkten mjukas in över vid varje klippbyte (matchar cross-fade). */
export const HERO_FOCUS_BLEND = 0.7;

/** Interpolerat horisontellt motivläge (0–1) vid en given tidpunkt. */
export const heroFocusXAt = (time: number): number => {
  const pts = HERO_FOCUS_POINTS;
  let index = 0;
  for (let i = 0; i < pts.length; i++) if (time >= pts[i].t) index = i;
  const current = pts[index];
  const next = pts[index + 1];
  if (!next) return current.x;
  const blendStart = next.t - HERO_FOCUS_BLEND / 2;
  if (time <= blendStart) return current.x;
  const p = Math.min(1, (time - blendStart) / HERO_FOCUS_BLEND);
  const eased = p * p * (3 - 2 * p);
  return current.x + (next.x - current.x) * eased;
};

/**
 * Räkna om motivläget till ett `object-position`-värde i procent.
 *
 * `ratio` = skalad videobredd / containerbredd (hur många gånger bredare bilden
 * är än ytan efter `object-cover`). Är den ~1 sker ingen horisontell beskärning
 * och vi låter bilden vara centrerad.
 */
export const heroObjectPositionX = (focusX: number, ratio: number): number => {
  if (!Number.isFinite(ratio) || ratio <= 1.001) return 50;
  const p = (focusX * ratio - 0.5) / (ratio - 1);
  return Math.min(100, Math.max(0, p * 100));
};

