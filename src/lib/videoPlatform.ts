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

/* ------------------------------------------------------------------ *
 * Adaptiv kvalitetsstege (mätt, inte gissad)
 * ------------------------------------------------------------------ *
 * Tidigare fick ALLA Windows-maskiner den mest konservativa källan, för
 * att den svagaste tänkbara laptopen skulle klara den. Följden: en stark
 * stationär med extern 4K-skärm — som utan problem klarar full kvalitet —
 * fick samma grötiga bild som en 4-kärnig ultrabook.
 *
 * Nu görs det tvärtom: vi STARTAR högt när hårdvaran mäter starkt och
 * degraderar bara om uppspelningen faktiskt tappar bildrutor. Beslutet
 * sparas i sessionStorage så att sidan inte pendlar mellan nivåerna.
 */

export type VideoQualityTier = 'high' | 'safe';

/**
 * Nyckeln lagrar ENBART hälsovaktens beslut ("den här maskinen tappade
 * bildrutor"). Skärmuppsättningen lagras medvetet inte — den kan ändras när
 * som helst under sessionen och måste därför läsas av på nytt varje gång.
 */
const TIER_KEY = 'parium:video-degraded';

const readDegraded = (): boolean => {
  try {
    return sessionStorage.getItem(TIER_KEY) === '1';
  } catch {
    return false;
  }
};

const writeDegraded = () => {
  try { sessionStorage.setItem(TIER_KEY, '1'); } catch { /* private mode */ }
};

/**
 * Kör skrivbordet utökat över flera skärmar?
 *
 * Spegling (samma bild till två portar) är billigt för GPU:n — den skickar en
 * färdig bild två gånger. Utökat skrivbord är dubbelt arbete: två separata
 * kompositionsplan, ofta med olika uppdateringsfrekvens. På integrerade
 * Intel-GPU:er är det exakt där video-decodern får slut på budget.
 *
 * `screen.isExtended` finns i Chromium (Windows/ChromeOS) och är false vid
 * spegling — precis den skillnad vi behöver. Saknas API:et antar vi en skärm.
 */
export const isExtendedDisplay = () => {
  if (typeof window === 'undefined') return false;
  const s = window.screen as Screen & { isExtended?: boolean };
  return s?.isExtended === true;
};

/**
 * Klarar den här maskinen den skarpa källan?
 *
 * Kriterier: minst 8 logiska kärnor och (när webbläsaren rapporterar det)
 * minst 8 GB RAM, samt en uppkoppling utan sparläge. Det utesluter i praktiken
 * ultrabooks med delad GPU-minnesbudget men släpper igenom i stort sett alla
 * stationära och moderna bärbara med dedikerad eller modern integrerad GPU —
 * alltså exakt de maskiner som driver externa skärmar.
 */
const hardwareLooksStrong = () => {
  if (typeof navigator === 'undefined') return false;
  if (prefersReducedData()) return false;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores < 8) return false;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (typeof mem === 'number' && mem < 8) return false;
  return true;
};

/**
 * Aktuell kvalitetsnivå.
 *
 * Ordning: hälsovaktens degradering (sticky) → utökat skrivbord på Windows
 * (dynamiskt, återställs när skärmen kopplas ur) → hårdvarumätning.
 */
export const getVideoQualityTier = (): VideoQualityTier => {
  if (typeof window === 'undefined') return 'safe';
  if (readDegraded()) return 'safe';
  if (isWindowsDevice() && isExtendedDisplay()) return 'safe';
  return hardwareLooksStrong() ? 'high' : 'safe';
};

/** Tvinga ner sessionen ett steg (anropas av hälsovakten vid frame drops). */
export const degradeVideoQuality = () => {
  if (typeof window === 'undefined') return false;
  if (readDegraded()) return false;
  writeDegraded();
  window.dispatchEvent(new CustomEvent('parium:video-degraded'));
  return true;
};

/**
 * Bevaka skärmuppsättningen och signalera när kvalitetsnivån ändras.
 *
 * Slår användaren i HDMI och utökar skrivbordet går vi ner i säkert läge INNAN
 * hacket hinner synas; dras skärmen ur går vi tillbaka upp till full skärpa
 * utan omladdning. Returnerar en avregistreringsfunktion.
 */
export const watchDisplayTopology = (onChange: (tier: VideoQualityTier) => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const s = window.screen as unknown as {
    isExtended?: boolean;
    addEventListener?: (t: string, cb: () => void) => void;
    removeEventListener?: (t: string, cb: () => void) => void;
  };
  if (typeof s?.isExtended !== 'boolean' || typeof s.addEventListener !== 'function') return () => {};
  let last = getVideoQualityTier();
  const handler = () => {
    const next = getVideoQualityTier();
    if (next === last) return;
    last = next;
    onChange(next);
  };
  s.addEventListener('change', handler);
  return () => s.removeEventListener?.('change', handler);
};


/**
 * Hälsovakt: mäter faktiskt tappade bildrutor på ett <video>-element.
 *
 * Detta är skillnaden mellan "vi tror att Windows är svagt" och "den här
 * maskinen klarar det inte". Tappas mer än 12 % av bildrutorna över ett
 * meningsfullt urval degraderas sessionen en gång — sedan är vakten klar.
 * Returnerar en avregistreringsfunktion.
 */
export const watchPlaybackHealth = (
  video: HTMLVideoElement,
  onDegrade: () => void,
): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const q = (video as unknown as { getVideoPlaybackQuality?: () => VideoPlaybackQuality })
    .getVideoPlaybackQuality;
  if (typeof q !== 'function') return () => {};
  let stopped = false;
  const timer = window.setInterval(() => {
    if (stopped) return;
    const stats = video.getVideoPlaybackQuality();
    const total = stats.totalVideoFrames;
    const dropped = stats.droppedVideoFrames;
    // Kräv ett rimligt urval innan vi dömer — kallstartens första sekunder
    // tappar ofta någon ruta helt normalt.
    if (total < 150) return;
    if (dropped / total > 0.12) {
      stopped = true;
      window.clearInterval(timer);
      if (degradeVideoQuality()) onDegrade();
    }
    // Ser det bra ut efter en dryg minut behöver vi inte mäta mer.
    if (total > 3000) { stopped = true; window.clearInterval(timer); }
  }, 1500);
  return () => { stopped = true; window.clearInterval(timer); };
};

/**
 * Antal videor som får spela samtidigt i galleriet.
 *
 * "Alltid igång" är standard: källorna är lätta och att pausa/starta kort
 * under scroll kändes stressigt (en video låg pausad exakt när användaren kom
 * fram). Bara sparläge, svaga enheter och Windows i säkert läge får ett
 * glidande fönster.
 */
export const getMaxConcurrentVideos = () => {
  if (prefersReducedData()) return 1;
  if (isLowPowerDevice()) return getVideoPlatform() === 'android' ? 3 : 4;
  // Windows i säkert läge (svagare maskin, eller degraderad av hälsovakten):
  // håll nere antalet parallella decoders så att hero-videon alltid får budget.
  if (isWindowsDevice() && getVideoQualityTier() === 'safe') return 4;
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
  // Sparläge/långsam uppkoppling laddar inget i förväg; alla andra värmer
  // decodern med `metadata` så att bytet från poster till första bildruta
  // inte syns som ett "pop". Koordinatorn höjer till `auto` vid uppspelning.
  if (prefersReducedData()) return 'none';
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
