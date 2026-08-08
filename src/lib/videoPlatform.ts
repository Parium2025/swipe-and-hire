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

/**
 * Antal videor som får spela samtidigt i galleriet.
 *
 * Windows och Android hålls till högst två samtidiga strömmar. Det lämnar en
 * hårdvarudecoder ledig åt telefonvideon och håller scroll-kompositorn mjuk.
 * Apple behåller sin tidigare budget på tre.
 */
export const getMaxConcurrentVideos = () => {
  if (prefersReducedData()) return 1;
  switch (getVideoPlatform()) {
    case 'windows':
      // Tre samtidiga 520px-strömmar: två platser går till strippens ytterkanter
      // (annars spelas aldrig första/sista kortet) och en till kortet i mitten.
      // Källorna är den lätta Windows-mastern, så decode-trycket är litet.
      return isLowPowerDevice() ? 2 : 3;
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

/**
 * `preload`-strategi för gallerivideor.
 *
 * Windows-desktop får `metadata`: utan det ligger kortet kvar på poster tills
 * decodern hunnit initieras när kortet når mitten — det syns som ett "pop" när
 * bilden byts mot första bildrutan. Med metadata är decodern redan varm och
 * bytet blir osynligt. Android och sparläge behåller `none` (bandbredd).
 */
export const getGalleryPreload = (): 'none' | 'metadata' => {
  const platform = getVideoPlatform();
  if (prefersReducedData()) return 'none';
  if (platform === 'android') return 'none';
  // Windows-korten uppgraderas till `auto` först när koordinatorn väljer dem.
  // Att ge alla åtta `metadata` vid mount initierade åtta demuxers samtidigt
  // och motverkade concurrency-taket på två aktiva strömmar.
  if (platform === 'windows') return 'none';
  return 'metadata';
};

/**
 * Ska tunga `backdrop-filter`-ytor ersättas med en statisk translucent yta?
 *
 * Varför: backdrop-blur måste räkna om suddningen av allt som ligger BAKOM
 * elementet varje gång bakgrunden rör sig. På landningssidan ligger korten
 * ovanpå en animerad gradient som rör sig konstant, så blurren räknas om varje
 * frame. macOS gör det på GPU med en optimerad separabel pass; Chrome/Edge på
 * Windows med integrerad GPU (och fraktionell DPR) faller ofta tillbaka på en
 * betydligt dyrare väg → tappade frames exakt när användaren scrollar förbi
 * feature-korten. Vi behåller glaskänslan via en tätare bakgrundsfärg istället.
 */
export const prefersStaticGlass = () => {
  if (typeof window === 'undefined') return false;
  return getVideoPlatform() === 'windows' || isLowPowerDevice();
};
