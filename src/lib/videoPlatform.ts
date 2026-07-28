/**
 * Central plattforms- och kapacitetsdetektion för landningssidans videor.
 *
 * Varför: kvalitet och antal samtidiga videoströmmar måste styras per
 * plattform. Apple har extremt stabil hårdvaruavkodning, Windows varierar med
 * GPU/drivrutin, och Android-telefoner har små skärmar men ofta svag
 * decode-budget — de ska därför ha lätta källor, inte desktop-filer.
 *
 * All detektion är best-effort och SSR-säker.
 */

export type VideoPlatform = 'apple' | 'windows' | 'android' | 'other';

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);

export const isAppleDevice = () => {
  const s = ua();
  if (!s) return false;
  const iOS = /iPad|iPhone|iPod/.test(s);
  // iPadOS 13+ rapporterar sig som Mac med touch.
  const iPadOS = /Macintosh/.test(s) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
  return iOS || iPadOS || /Macintosh|Mac OS X/.test(s);
};

export const isWindowsDevice = () => /Windows NT/i.test(ua());

export const isAndroidDevice = () => /Android/i.test(ua());

export const getVideoPlatform = (): VideoPlatform => {
  if (isWindowsDevice()) return 'windows';
  if (isAndroidDevice()) return 'android';
  if (isAppleDevice()) return 'apple';
  return 'other';
};

/** Sparläge/långsam uppkoppling → dra ner allt. */
export const prefersReducedData = () => {
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } })?.connection;
  if (!c) return false;
  return Boolean(c.saveData) || /^(slow-2g|2g|3g)$/.test(c.effectiveType ?? '');
};

/** Grov enhetsstyrka: RAM + kärnor. Används för att skala antal videoströmmar. */
export const isLowPowerDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if (typeof mem === 'number' && mem <= 4) return true;
  if (typeof cores === 'number' && cores <= 4) return true;
  return false;
};

/**
 * Ska enheten få den lätta, nedskalade videokällan?
 * Windows (decode-budget) och Android (liten skärm + svag decode) → ja.
 * Även Apple i sparläge/svag uppkoppling.
 */
export const prefersLightweightVideo = () => {
  const platform = getVideoPlatform();
  if (platform === 'windows' || platform === 'android') return true;
  return prefersReducedData();
};

/** Antal videor som får spela samtidigt i galleriet. */
export const getMaxConcurrentVideos = () => {
  if (prefersReducedData()) return 1;
  switch (getVideoPlatform()) {
    case 'windows':
      return isLowPowerDevice() ? 2 : 4;
    case 'android':
      return isLowPowerDevice() ? 1 : 2;
    case 'apple':
      return 3;
    default:
      return isLowPowerDevice() ? 2 : 3;
  }
};

/** Ska decoders frigöras (pausas) när galleriet lämnar viewporten? */
export const shouldFreeDecodersOnLeave = () => {
  if (typeof window === 'undefined') return false;
  return (
    getVideoPlatform() !== 'apple' ||
    window.matchMedia('(pointer: coarse)').matches ||
    isLowPowerDevice()
  );
};

/** `preload`-strategi för gallerivideor. */
export const getGalleryPreload = (): 'none' | 'metadata' => {
  const platform = getVideoPlatform();
  if (platform === 'windows' || platform === 'android' || prefersReducedData()) return 'none';
  return 'metadata';
};
