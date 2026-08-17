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
  // ALLTID-IGÅNG är standard. Att pausa/starta kort under scroll kändes
  // "stressigt" och gjorde att en video låg pausad exakt när användaren kom
  // fram. Källorna är lätta (4:5, ~2,4 Mbit/s) så många samtidiga strömmar
  // klaras av Apple-enheter. Bara sparläge/riktigt svaga enheter får
  // ett glidande fönster.
  if (prefersReducedData()) return 1;
  // Windows: Chromium delar en begränsad pool av hårdvarudekodrar per GPU-
  // utgång. Kör man dessutom laptopskärm + extern HDMI-skärm samtidigt måste
  // videoplanen komponeras två gånger. Åtta strömmar tömde poolen helt — då
  // föll galleriet till mjukvaruavkodning och telefonvideon i hero fick ingen
  // decoder alls (svart/fryst ram + segt scroll). Tre strömmar lämnar alltid
  // budget kvar åt telefonen.
  if (isWindowsDevice()) return 3;
  if (isLowPowerDevice()) return getVideoPlatform() === 'android' ? 3 : 4;
  return 8;
};



/** Ska decoders frigöras (pausas) när galleriet lämnar viewporten? */
export const shouldFreeDecodersOnLeave = () => {
  if (typeof window === 'undefined') return false;
  // Apple: videorna ska ALDRIG pausas när galleriet lämnar viewporten — då
  // ligger de pausade när användaren kommer tillbaka.
  //
  // Windows: tvärtom. Chromium har en begränsad pool av hårdvarudekodrar per
  // GPU-utgång. Scrollar man ner till galleriet och sedan tillbaka upp har
  // gallerivideorna tagit poolen, och telefonvideon i hero (som frigör sin
  // decoder när den lämnar viewporten) får ingen tillbaka → svart/fryst ram.
  // Genom att frigöra galleriets decoders när sektionen lämnar viewporten
  // finns det alltid budget kvar åt hero-videon.
  if (isWindowsDevice()) return true;
  return prefersReducedData() || isLowPowerDevice();
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
  if (platform === 'android') return 'metadata';
  // Windows-korten uppgraderas till `auto` först när koordinatorn väljer dem.
  // Att ge alla åtta `metadata` vid mount initierade åtta demuxers samtidigt
  // och motverkade concurrency-taket på två aktiva strömmar.
  if (platform === 'windows') return 'metadata';
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
