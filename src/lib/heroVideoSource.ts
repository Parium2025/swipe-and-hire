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
import hero4k from '@/assets/hero-video-v5.mp4.asset.json';

/** 4K-master (CDN). Endast riktiga desktops med bra nät och hårdvaruavkodning. */
export const HERO_VIDEO_4K = hero4k.url;

/** 1080p-master (lokal). Windows/Android, mobil, sparläge, svagt nät. */
export const HERO_VIDEO_1080 = '/hero-video-1080-v5.mp4';

/** Poster = LCP-kandidat på landningssidan. */
export const HERO_POSTER = '/hero-video-poster-v5.jpg';

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

/** Windows/Android har varierande decode-budget → alltid 1080p-mastern. */
const lightweightPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Windows NT|Android/i.test(navigator.userAgent || '');

/** Välj EXAKT en källa — aldrig flera <source> med `media`, Chrome respekterar det inte. */
export const pickHeroSrc = (): string => {
  if (typeof window === 'undefined') return HERO_VIDEO_1080;
  const desktop =
    typeof window.matchMedia === 'function' && window.matchMedia(HERO_DESKTOP_QUERY).matches;
  return desktop && !lightweightPlatform() && !reducedData() ? HERO_VIDEO_4K : HERO_VIDEO_1080;
};

/** Användaren har bett systemet om mindre rörelse → visa stillbild, inte film. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
