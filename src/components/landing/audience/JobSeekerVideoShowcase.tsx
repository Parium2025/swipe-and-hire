import { useEffect, useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import hevcAsset from '@/assets/showcase-jobseeker.hevc.mp4.asset.json';
import hiCrispAsset from '@/assets/showcase-jobseeker-hi-crisp.mp4.asset.json';
import winCrispAsset from '@/assets/showcase-jobseeker-win-crisp.mp4.asset.json';
import posterAsset from '@/assets/showcase-jobseeker-poster.jpg.asset.json';
import windowsLiteAsset from '@/assets/showcase-jobseeker-windows-lite.mp4.asset.json';
import windowsSafe60Asset from '@/assets/showcase-jobseeker-windows-safe60.mp4.asset.json';
import windowsSafe60_648Asset from '@/assets/showcase-jobseeker-safe60-648.mp4.asset.json';
import windowsSafe60_810Asset from '@/assets/showcase-jobseeker-safe60-810.mp4.asset.json';
import fit432Asset from '@/assets/showcase-jobseeker-fit432.mp4.asset.json';
import { isAndroidDevice, isAppleDevice, isWindowsDevice, prefersReducedData } from '@/lib/videoPlatform';

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Skärmens proportion = videons EXAKTA proportion (9:19.5).
 *
 * Tidigare låg skärmen på 9:18.3 och videon täcktes med object-cover, vilket
 * innebar att browsern skalade upp filmen ~6.6 % och klippte bort toppen och
 * botten. Det var därför appens överkant ("Visa filter", krysset) hamnade fel
 * och såg beskuren ut. Med exakt samma ratio ritas originalvideon 1:1 — inget
 * klipps, inget skalas upp, och skärpan blir maximal.
 *
 * 9:19.5 ≈ 2.167 är dessutom en riktig iPhone 16 Pro-skärm (1206×2622).
 */
const ASPECT = '9 / 19.5';


/**
 * HEVC erbjuds ENDAST till Apple-Safari.
 *
 * Varför: Edge/Chrome på Windows rapporterar ofta stöd för `hvc1`
 * (HEVC Video Extension / Win11) men saknar i praktiken hårdvaruavkodning för
 * den profilen → browsern faller tillbaka på software-decode och videon hackar.
 * H.264 High@4.0 är däremot hårdvaruaccelererat på i princip alla Windows-GPU:er.
 */
const prefersHevc = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isAppleSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  if (!isAppleSafari) return false;
  const probe = document.createElement('video');
  return probe.canPlayType('video/mp4; codecs="hvc1"') === 'probably';
};

/**
 * Windows får en egen H.264 Constrained Baseline@3.2-källa i 60 fps
 * (~1.07 Mbps, 432×936).
 * Viktigt: originalinspelningen är 60 fps. När Windows tidigare fick en 30 fps-
 * transcode såg swipe-animationerna ut som lagg även när bufferten var varm.
 * Lika viktigt: Chrome/Edge på Windows kan hacka på B-frames/frame reordering
 * vid kallstart. Därför är Windows-filen kodad utan B-frames, med kort GOP och
 * `fastdecode`, så varje bildruta kan avkodas i ordning utan omkastningsbuffert.
 */
// Kallstart på Windows/Chromium: native autoplay startar så fort ~0,2 s är
// buffrat. På en extern HDMI-skärm (annan uppdateringsfrekvens/GPU-plan än
// den interna panelen) hinner dekodern då aldrig ikapp och de första
// sekunderna hackar — men efter en scroll bort och tillbaka är filen cachad
// och allt flyter. Vi håller därför postern kvar tills en riktig buffert finns
// och startar först då. Apple/iOS-vägen är helt oförändrad (false).
const usesBufferedStart = () => {
  if (typeof navigator === 'undefined') return false;
  if (isAppleDevice()) return false;
  return isWindowsDevice();
};

/**
 * Windows/Chromium kan droppa frames när en <video>-overlay börjar spela medan
 * planet samtidigt flyttas/skalats av layouten. Det matchar beteendet här:
 * första rendern hackar, men efter att användaren scrollat bort och tillbaka är
 * telefonens geometri redan stabil och videon flyter perfekt. Extra tydligt på
 * en extern skärm, där Chrome måste flytta video-planet mellan GPU-outputs.
 */
const usesStableGeometryStart = () => {
  if (typeof navigator === 'undefined') return false;
  if (isAppleDevice()) return false;
  return isWindowsDevice();
};


/**
 * Upplösningsstege — vald efter FAKTISKA enhetspixlar, inte efter operativsystem.
 *
 * Detta är kärnan i skärpeproblemet på Windows: en video som är bredare än den
 * yta den ritas på måste skalas ned av browsern. Chrome/Edge på Windows gör den
 * nedskalningen i video-overlayen med ett billigt bilinjärt filter — text blir
 * grötig oavsett hur hög bitrate källan har (därför gav bitrate-höjningen noll
 * skillnad). Safari på Apple använder ett betydligt bättre filter, vilket är
 * exakt varför samma fil ser skarp ut där och suddig här.
 *
 * Lösningen är att INTE låta browsern skala: vi levererar en master vars bredd
 * ligger så nära `CSS-bredd × devicePixelRatio` som möjligt. Nedskalningen görs
 * då i förväg med Lanczos + lätt unsharp (offline, högsta kvalitet) istället för
 * av Chrome i realtid.
 */
const LADDER = [
  { w: 432, url: fit432Asset.url },
  { w: 648, url: winCrispAsset.url },
  { w: 810, url: hiCrispAsset.url },
] as const;

const supportsWindowsSafe60 = () => {
  if (typeof document === 'undefined') return false;
  const probe = document.createElement('video');
  return probe.canPlayType('video/mp4; codecs="avc1.42C020"') !== '';
};

/**
 * Stor Windows-yta betyder ofta extern HDMI/DisplayPort-skärm. Där är 60 fps-
 * videoplanet betydligt dyrare för Chromium att flytta och komponera än på den
 * inbyggda laptopskärmen. Vi kan inte läsa vilken kabel som används, men
 * viewportens storlek är en stabil och integritetsvänlig signal för exakt den
 * situationen. 30 fps-mastern halverar decode/compositor-arbetet och är skarp
 * nog för telefonens maximala CSS-bredd på 285 px.
 */
const prefersLargeWindowsDisplayTrack = () => {
  if (typeof window === 'undefined' || !isWindowsDevice()) return false;
  // Undantag: hög pixeltäthet (4K/200 %-skalning, ultrabreda hi-dpi-paneler).
  // Där skulle 432 px-mastern behöva skalas UPP av browsern och texten i
  // appen blir grötig. De skärmarna får istället rätt rung ur safe-stegen.
  const dpr = window.devicePixelRatio || 1;
  if (dpr >= 1.5) return false;
  return window.innerWidth >= 1280 || window.innerHeight >= 900;
};


/** Uppskattad CSS-bredd på telefonen innan första målningen (matchar max-w-stegen). */
const estimateCssWidth = (widthPx?: number) => {
  if (widthPx) return widthPx;
  if (typeof window === 'undefined') return 285;
  const vw = window.innerWidth;
  if (vw >= 1280) return 285;
  if (vw >= 1024) return 260;
  if (vw >= 768) return 230;
  if (vw >= 640) return 215;
  return Math.min(190, vw - 48);
};

/**
 * Bandbreddstak för stegen.
 *
 * Filerna ligger på 1.55 / 3.12 / 3.30 Mbps. En video kan bara spelas
 * oavbrutet om nätet klarar mer än videons bitrate med marginal — annars
 * hinner bufferten ta slut och Chrome/Edge på Windows visar det som att
 * videon "fastnar" mitt i loopen. I preview (localhost) händer det aldrig,
 * vilket är precis därför problemet bara syns i skarpt läge.
 *
 * Vi låter därför uppmätt `downlink` sätta ett TAK för vilket steg som får
 * väljas. Har vi ingen mätning behålls det skarpaste steget.
 */
const maxWidthForConnection = () => {
  if (typeof navigator === 'undefined') return Infinity;
  const c = (navigator as unknown as {
    connection?: { saveData?: boolean; downlink?: number; effectiveType?: string };
  }).connection;
  if (!c) return Infinity;
  if (c.saveData) return 432;
  if (c.effectiveType && /(^|-)(2g|slow-2g|3g)$/i.test(c.effectiveType)) return 432;
  const down = typeof c.downlink === 'number' ? c.downlink : undefined;
  if (down === undefined || down <= 0) return Infinity;
  if (down < 4) return 432;
  if (down < 8) return 648;
  return Infinity;
};

const pickLadder = (widthPx?: number) => {
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 3);
  const target = estimateCssWidth(widthPx) * dpr;
  const cap = maxWidthForConnection();
  const allowed = LADDER.filter((r) => r.w <= cap);
  const pool = allowed.length > 0 ? allowed : [LADDER[0]];
  // Välj minsta rung som TÄCKER målet fullt ut. Ingen tolerans nedåt: en källa
  // som är smalare än ytan måste skalas UPP av browsern = garanterat suddig text.
  return (pool.find((r) => r.w >= target) ?? pool[pool.length - 1]).url;
};

/**
 * Windows/Android-stege — SAMMA skärpelogik som Apple, men med den
 * decoder-säkra kodningen (Constrained Baseline, 60 fps, inga B-frames,
 * kort GOP, fastdecode).
 *
 * Tidigare fick Windows och Android ALLTID 432 px bred källa. Det räcker på en
 * 100 %-skalad laptop (285 CSS-px × 1.25 dpr ≈ 356), men på en 4K-laptop med
 * 200 % skalning (dpr 2 → 570) och på Android-telefoner (dpr 3 → ~570) tvingas
 * browsern skala UPP filmen — vilket är exakt den suddighet vi bekämpar på
 * Apple-sidan. Nu väljs minsta rung som täcker den faktiska pixelytan, med
 * samma bandbreddstak som Apple-stegen.
 */
const SAFE_LADDER = [
  { w: 432, url: windowsSafe60Asset.url },
  { w: 648, url: windowsSafe60_648Asset.url },
  { w: 810, url: windowsSafe60_810Asset.url },
] as const;

const pickSafeLadder = (widthPx?: number) => {
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 3);
  const target = estimateCssWidth(widthPx) * dpr;
  const cap = maxWidthForConnection();
  const allowed = SAFE_LADDER.filter((r) => r.w <= cap);
  const pool = allowed.length > 0 ? allowed : [SAFE_LADDER[0]];
  return (pool.find((r) => r.w >= target) ?? pool[pool.length - 1]).url;
};

const getSources = (widthPx?: number) =>
  prefersHevc()
    ? [
        { src: hevcAsset.url, type: 'video/mp4; codecs="hvc1"' },
        { src: hiCrispAsset.url, type: 'video/mp4' },
      ]
    : prefersReducedData()
      ? [{ src: windowsLiteAsset.url, type: 'video/mp4' }]
      : isWindowsDevice()
        ? [
            // Den dedikerade Windows-mastern är 60 fps, Constrained Baseline,
            // yuv420p och saknar B-frames. Det matchar originalets bildfrekvens
            // och undviker frame-reordering vid kallstart. windowsLite är 30 fps,
            // Main profile och har B-frames, så den gav precis det ryckiga förlopp
            // som kommentaren ovan sade att Windows-källan skulle undvika.
            // Välj bara 60-fps-mastern när browsern själv accepterar dess exakta
            // codecprofil. Annars används den brett kompatibla 30-fps-filen.
            prefersLargeWindowsDisplayTrack()
              ? { src: windowsLiteAsset.url, type: 'video/mp4' }
              : supportsWindowsSafe60()
              ? { src: pickSafeLadder(widthPx), type: 'video/mp4; codecs="avc1.42C020"' }
              : { src: windowsLiteAsset.url, type: 'video/mp4' },
          ]
        : isAndroidDevice()
          ? [
              // Androids H.264-hårdvaruväg är jämnare mellan olika GPU:er än VP9.
              // Samma decoder-säkra profil som Windows, men nu i rätt upplösning
              // för telefonens dpr i stället för en fast 432 px-uppskalning.
              supportsWindowsSafe60()
                ? { src: pickSafeLadder(widthPx), type: 'video/mp4; codecs="avc1.42C020"' }
                : { src: windowsLiteAsset.url, type: 'video/mp4' },
            ]
          : [{ src: pickLadder(widthPx), type: 'video/mp4' }];




/**
 * Video-showcase för jobbsökare — en riktig telefoninspelning av appen i en
 * fotorealistisk iPhone-ram (titanram, tunna ramar, Dynamic Island och
 * sidoknappar).
 *
 * Uppspelning: ett enda videolager med native `loop` + autoplay. Ingen
 * korsfade, ingen manuell omstart — bara rå, oavbruten loop.
 */
const JobSeekerVideoShowcase = ({
  className = '',
  widthPx,
  instant = false,
  active = true,
}: {
  className?: string;
  /** Explicit bredd i px — används när telefonen ska matcha hero-layoutens mått. */
  widthPx?: number;
  /** Hoppa över intro-animationen (telefonen är redan på plats direkt). */
  instant?: boolean;
  /** Pausa videodecode helt när telefonen är visuellt dold utanför hero-zonen. */
  active?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sources, setSources] = useState<ReturnType<typeof getSources>>(() => getSources(widthPx));

  /**
   * Posterlager: <video poster> ritas inte alltid direkt i Safari/iOS — ramen
   * kan stå svart tills första bildrutan är dekodad. Ett riktigt <img> ovanpå
   * ritas i samma frame som layouten och fasas ut vid första `playing`.
   */
  const [firstFramePainted, setFirstFramePainted] = useState(false);
  const [posterVisible, setPosterVisible] = useState(true);
  // Poster-fejden behövs bara på Windows för att dölja decoder-blixten.
  // iOS/macOS ritar videon rent direkt, så där byter vi utan transition.
  const posterTransition = isWindowsDevice()
    ? 'transition-opacity duration-[250ms] ease-out'
    : isAppleDevice()
      ? ''
      : 'transition-opacity duration-100 ease-out';
  // Spela Windows-filen direkt från dess vanliga URL. Den tidigare Blob-vägen
  // gjorde först en full fetch och matade sedan samma bytes till <video> via en
  // object URL. Chrome/Edge kunde inte initiera MP4-demuxern från den vägen i
  // produktion (readyState stannade på 0), så postern blev kvar för alltid.
  // Apple-vägen och dess HEVC/H.264-källor är helt oförändrade.
  const visibleSources = sources;

  /**
   * Kallstartsspärr (ENDAST Windows / sparläge).
   *
   * Problemet: browsern startar uppspelningen så fort `readyState >= 2`, dvs.
   * när bara någon tiondels sekund är buffrad. På ett kallt nät hinner
   * bufferten ta slut direkt och de första sekunderna blir en serie
   * mikro-stopp — exakt det "oj vad tömtladdat" användaren ser. När filen väl
   * ligger i HTTP-cachen (varm) startar den full och allt känns perfekt.
   *
   * Lösningen: håll videon pausad på posterbilden tills ~2 s faktiskt är
   * buffrat (eller max 4 s), och starta först då. Poster = stillbild = noll
   * hack. Apple/touch-vägen behåller native autoplay helt orörd.
   */
  const coldGateRef = useRef<boolean | null>(null);
  if (coldGateRef.current === null) coldGateRef.current = usesBufferedStart();
  const coldGate = coldGateRef.current;
  const geometryGateRef = useRef<boolean | null>(null);
  if (geometryGateRef.current === null) geometryGateRef.current = usesStableGeometryStart();
  const geometryGate = geometryGateRef.current;
  // Frigör alltid telefonvideons decoder när hero-zonen lämnar viewporten.
  // Windows behöver den budgeten till galleriet längre ned på sidan.
  const keepAliveWhenHidden = false;
  const warmRef = useRef(false);

  useEffect(() => {
    if (!firstFramePainted) return;
    const t = window.setTimeout(() => setPosterVisible(false), 120);
    return () => window.clearTimeout(t);
  }, [firstFramePainted]);

  /**
   * Skärmbyte i drift: flyttas fönstret från en 1x-skärm till en Retina-/4K-
   * panel (eller ändras systemskalningen under skärmdelning) förändras
   * devicePixelRatio. Källan valdes vid mount och skulle annars skalas upp av
   * browsern = suddig text på den nya skärmen. Vi väljer om stegen och byter
   * ENDAST uppåt (aldrig ned), med bevarad tidsposition så bytet inte syns.
   */
  const currentSrc = sources[0]?.src;
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    let mq: MediaQueryList | null = null;
    let listener: (() => void) | null = null;
    let cancelled = false;

    const detach = () => {
      if (mq && listener) mq.removeEventListener?.('change', listener);
      mq = null;
      listener = null;
    };

    const attach = () => {
      if (cancelled) return;
      detach();
      const dpr = window.devicePixelRatio || 1;
      mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
      listener = () => {
        if (cancelled) return;
        setSources((prev) => {
          const next = getSources(widthPx);
          const nextSrc = next[0]?.src;
          const prevSrc = prev[0]?.src;
          if (!nextSrc || nextSrc === prevSrc) return prev;
          // Byt ENDAST uppåt. En nedgradering mitt i uppspelningen kostar en
          // full omladdning utan att ge något — och kan dessutom göra texten
          // suddigare om mätningen (t.ex. `downlink`) tillfälligt dippar.
          if (rungWidth(nextSrc) <= rungWidth(prevSrc)) return prev;
          return next;
        });
        attach();
      };
      mq.addEventListener?.('change', listener, { once: true });
    };
    attach();

    return () => {
      cancelled = true;
      detach();
    };
  }, [widthPx]);


  // Byt faktisk källa på elementet när stegen valts om (inte vid första mount).
  const mountedSrcRef = useRef<string | undefined>(currentSrc);
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !currentSrc || mountedSrcRef.current === currentSrc) return;
    mountedSrcRef.current = currentSrc;
    const resumeAt = Number.isFinite(v.currentTime) ? v.currentTime : 0;
    const onReady = () => {
      try {
        if (Number.isFinite(v.duration) && v.duration > 0) {
          v.currentTime = Math.min(resumeAt, Math.max(0, v.duration - 0.1));
        }
      } catch { /* best effort */ }
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };
    v.addEventListener('loadedmetadata', onReady, { once: true });
    try { v.load(); } catch { /* noop */ }
    return () => v.removeEventListener('loadedmetadata', onReady);
  }, [currentSrc]);



  const safePlay = useCallback((v: HTMLVideoElement | null) => {
    if (!v || (!active && !keepAliveWhenHidden) || document.visibilityState !== 'visible') return;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [active, keepAliveWhenHidden]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.loop = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    if (!coldGate) v.setAttribute('autoplay', '');
    v.disablePictureInPicture = true;
    try { (v as unknown as { disableRemotePlayback?: boolean }).disableRemotePlayback = true; } catch { /* noop */ }

    // iOS Lågeffektläge (sparläge) blockerar autoplay helt tills sidan får en
    // användarinteraktion. Vi försöker därför om med kort intervall och
    // återupptar direkt vid första touch/scroll — samma mönster som hero-videon
    // på startsidan, så telefonen aldrig står kvar på en still bild.
    let retryTimer: number | null = null;
    const clearRetry = () => {
      if (retryTimer !== null) { window.clearTimeout(retryTimer); retryTimer = null; }
    };

    const attempt = () => {
      if ((!active && !keepAliveWhenHidden) || document.visibilityState !== 'visible') return;
      if (!v.paused && !v.ended) return;
      const p = v.play();
      if (p && typeof p.catch === 'function') {
        p.then(clearRetry).catch(() => {
          clearRetry();
          retryTimer = window.setTimeout(attempt, 600);
        });
      }
    };

    /** Hur många sekunder som är buffrat framför nuvarande position. */
    const aheadOf = (el: HTMLVideoElement) => {
      try {
        const t = el.currentTime;
        for (let i = 0; i < el.buffered.length; i += 1) {
          if (el.buffered.start(i) <= t + 0.1 && el.buffered.end(i) > t) return el.buffered.end(i) - t;
        }
      } catch {
        return Infinity;
      }
      return 0;
    };

    // Kallstart: vänta in en riktig buffert innan första play(). Max 6,5 s, sedan
    // startar vi ändå så att telefonen aldrig blir stående på posterbilden.
    // Målet är ADAPTIVT: 3 s är rätt på ett trögt nät, men på ett snabbt nät
    // (eller när filen redan ligger i HTTP-cachen) är det ren väntetid. Vi mäter
    // därför hur snabbt bufferten växer och sänker målet när nätet håller undan.
    const COLD_TARGET_SECONDS = 3;
    const COLD_FAST_TARGET_SECONDS = 1.2;
    const COLD_WARM_TARGET_SECONDS = 0.8;
    const COLD_MAX_WAIT_MS = 6500;
    // Har filen redan spelat stabilt i den här sessionen ligger den i cachen —
    // då är en lång buffringsspärr bara fördröjning.
    const warmSessionKey = 'parium:jobseeker-video-warm';
    let sessionWarm = false;
    try { sessionWarm = sessionStorage.getItem(warmSessionKey) === '1'; } catch { /* noop */ }


    let coldTimer: number | null = null;
    let geometryFrame: number | null = null;
    const clearCold = () => {
      if (coldTimer !== null) { window.clearInterval(coldTimer); coldTimer = null; }
    };

    /**
     * Windows-start: ladda/buffra direkt, men vänta med play() tills telefonens
     * pixelbox varit stabil i några frames. Annars kan Chrome flytta video-MPO-
     * planet samtidigt som första frames avkodas, vilket ser ut som nät-/codec-
     * lagg fast filen egentligen är rätt.
     */
    let geometrySettled = !geometryGate;
    let geometryWaitStarted = false;
    const waitForStableGeometry = (then: () => void) => {
      if (geometrySettled) { then(); return; }
      if (geometryWaitStarted) return;
      geometryWaitStarted = true;
      const startedAt = performance.now();
      let stableFrames = 0;
      let last: DOMRectReadOnly | null = null;

      const tick = () => {
        if (!keepAliveWhenHidden && !active) {
          geometryFrame = null;
          geometryWaitStarted = false;
          return;
        }

        const rect = v.getBoundingClientRect();
        const stable = last
          ? Math.abs(rect.left - last.left) < 0.25 &&
            Math.abs(rect.top - last.top) < 0.25 &&
            Math.abs(rect.width - last.width) < 0.25 &&
            Math.abs(rect.height - last.height) < 0.25
          : false;

        stableFrames = stable ? stableFrames + 1 : 0;
        last = rect;

        if (stableFrames >= 10 || performance.now() - startedAt >= 2500) {
          geometrySettled = true;
          geometryFrame = null;
          then();
          return;
        }

        geometryFrame = window.requestAnimationFrame(tick);
      };

      geometryFrame = window.requestAnimationFrame(tick);
    };

    const startWhenBuffered = () => {
      if (coldTimer !== null) return;
      try { v.preload = 'auto'; } catch { /* noop */ }
      if (v.readyState < 2) { try { v.load(); } catch { /* noop */ } }
      const startedAt = Date.now();
      let lastAhead = aheadOf(v);
      let lastAt = startedAt;
      coldTimer = window.setInterval(() => {
        if (!active && !keepAliveWhenHidden) { clearCold(); return; }
        const now = Date.now();
        const ahead = aheadOf(v);
        // Buffertens tillväxt i "sekunder video per sekund realtid". > 2 betyder
        // att nätet levererar dubbelt så fort som videon konsumeras → helt säkert
        // att starta tidigt, bufferten fortsätter växa medan den spelar.
        const growth = now > lastAt ? ((ahead - lastAhead) / ((now - lastAt) / 1000)) : 0;
        lastAhead = ahead;
        lastAt = now;

        const target = sessionWarm
          ? COLD_WARM_TARGET_SECONDS
          : growth >= 2 ? COLD_FAST_TARGET_SECONDS : COLD_TARGET_SECONDS;

        if (v.readyState >= 4 || ahead >= target || now - startedAt >= COLD_MAX_WAIT_MS) {
          clearCold();
          warmRef.current = true;
          attempt();
        }
      }, 100);
    };

    /**
     * Startpunkt: kallstartsspärr på Windows, direkt play överallt annars.
     *
     * På Windows väntar vi dessutom in `load`-eventet innan första play().
     * Vid en kall laddning pågår då fortfarande hydrering, bilddekodning och
     * hero-animationen — startar videodecodern mitt i den bursten hackar de
     * första sekunderna även när filen redan är hämtad. Vid en varm sidvisning
     * har `load` redan hänt, så den vägen ändras inte alls.
     *
     * Undantag: är filen redan cachad (varm session) eller helt buffrad finns
     * ingen burst att skydda sig mot — då är väntan på `load` bara död tid.
     */
    let loadWaitArmed = false;
    const startAfterLoad = (then: () => void) => {
      if (!coldGate || document.readyState === 'complete' || sessionWarm || v.readyState >= 4) { then(); return; }
      if (loadWaitArmed) return;
      loadWaitArmed = true;
      // Vänta inte i evighet på `load` — tunga tredjepartsresurser kan dra ut på
      // det långt efter att videon är spelklar.
      const proceed = () => { loadWaitArmed = false; then(); };
      window.addEventListener('load', proceed, { once: true });
      window.setTimeout(() => { if (loadWaitArmed) proceed(); }, 1800);
    };


    const kick = () => {
      startAfterLoad(() => {
        waitForStableGeometry(() => {
          if (coldGate && !warmRef.current) startWhenBuffered();
          else attempt();
        });
      });
    };


    // Apple/touch: starta omedelbart, redan innan events hinner trigga.
    if (!coldGate && !geometryGate && (active || keepAliveWhenHidden)) attempt();

    if (active || keepAliveWhenHidden) kick();
    else v.pause();


    const resume = () => {
      if (!active && !keepAliveWhenHidden) {
        if (!v.paused) v.pause();
        return;
      }
      kick();
    };

    /**
     * Buffringsvakt under uppspelning.
     *
     * Kallstarten hanteras av spärren ovan. Här fångar vi bara stopp som sker
     * mitt i loopen: vi väntar in lite ny data innan vi kickar igång igen,
     * istället för att spamma play() mot en tom buffert (vilket är precis det
     * som ger den hackiga känslan).
     */
    let stallTimer: number | null = null;
    const clearStall = () => {
      if (stallTimer !== null) { window.clearInterval(stallTimer); stallTimer = null; }
    };
    const onWaiting = () => {
      if ((!active && !keepAliveWhenHidden) || stallTimer !== null) return;
      try { v.preload = 'auto'; } catch { /* noop */ }
      // Windows behöver mer marginal innan återstart, annars stannar den igen
      // direkt. Apple/touch behåller det tidigare, snabbare tröskelvärdet.
      const needAhead = coldGate ? 1.5 : 0.65;
      let ticks = 0;
      stallTimer = window.setInterval(() => {
        ticks += 1;
        if ((!active && !keepAliveWhenHidden) || document.visibilityState !== 'visible') return;
        const ahead = aheadOf(v);
        const nearEnd = v.duration > 0 && v.currentTime > v.duration - 1.2;
        if (ahead >= needAhead || nearEnd || v.readyState >= 4 || ticks >= 20) {
          clearStall();
          attempt();
        }
      }, 250);
    };
    const onPlaying = () => clearStall();
    const onFirstStablePlay = () => {
      window.dispatchEvent(new CustomEvent('parium:jobseeker-video-stable'));
      // Filen finns nu i HTTP-cachen: nästa sidvisning i samma session får
      // starta nästan direkt istället för att vänta in hela kallstartsspärren.
      try { sessionStorage.setItem('parium:jobseeker-video-warm', '1'); } catch { /* noop */ }
      v.removeEventListener('playing', onFirstStablePlay);
    };

    /**
     * Dekodervakt för skärm-/GPU-byte.
     *
     * Chromium kan fortsätta rapportera `paused=false` och `readyState >= 2`
     * trots att videoplanet har frusit när ett fönster flyttas mellan skärmar.
     * Då kommer varken `waiting`, `stalled` eller `error`, så eventbaserad
     * återhämtning räcker inte. Vi kontrollerar därför att currentTime faktiskt
     * går framåt. Första nivån gör bara pause/play; först efter fortsatt stopp
     * återinitieras mediekedjan och samma tidsposition återställs.
     */
    let healthTimer: number | null = null;
    let displayTimer: number | null = null;
    let lastHealthTime = v.currentTime;
    let frozenTicks = 0;
    let rebuilding = false;

    const rebuildDecoder = () => {
      if (rebuilding || (!active && !keepAliveWhenHidden) || document.visibilityState !== 'visible') return;
      rebuilding = true;
      const resumeAt = Number.isFinite(v.currentTime) ? v.currentTime : 0;
      const release = () => {
        v.removeEventListener('loadedmetadata', restore);
        v.removeEventListener('error', release);
        rebuilding = false;
      };
      const restore = () => {
        release();
        try {
          if (Number.isFinite(v.duration) && v.duration > 0) {
            v.currentTime = Math.min(resumeAt, Math.max(0, v.duration - 0.1));
          }
        } catch { /* best effort */ }
        frozenTicks = 0;
        lastHealthTime = v.currentTime;
        attempt();
      };
      v.addEventListener('loadedmetadata', restore, { once: true });
      v.addEventListener('error', release, { once: true });
      try {
        v.pause();
        v.load();
      } catch {
        release();
        attempt();
      }
    };

    const checkHealth = () => {
      if ((!active && !keepAliveWhenHidden) || document.visibilityState !== 'visible' || rebuilding) {
        frozenTicks = 0;
        lastHealthTime = v.currentTime;
        return;
      }
      if (v.paused || v.ended || v.seeking || v.readyState < 2) {
        frozenTicks = 0;
        lastHealthTime = v.currentTime;
        attempt();
        return;
      }
      if (Math.abs(v.currentTime - lastHealthTime) < 0.04) {
        frozenTicks += 1;
        if (frozenTicks === 2) {
          try {
            v.pause();
            attempt();
          } catch { /* best effort */ }
        } else if (frozenTicks >= 5) {
          rebuildDecoder();
        }
      } else {
        frozenTicks = 0;
        lastHealthTime = v.currentTime;
      }
    };

    /**
     * BUGG som fanns här: vakten kördes på VARJE resize-event. På iOS/Android
     * skickar `visualViewport` resize varje gång adressfältet glider in/ut vid
     * scroll, och på desktop vid varje pixel när fönstret dras. Varje gång
     * pausades och startades videon om — ett synligt ryck mitt i uppspelningen
     * utan att någon skärm faktiskt bytts.
     *
     * Nu jämför vi en signatur av den fysiska skärmen (dpr + skärmupplösning +
     * färgdjup). Bara ett riktigt skärm-/GPU-byte eller ändrad systemskalning
     * triggar återhämtningen; vanlig storleksändring lämnar videon i fred.
     */
    const displaySignature = () =>
      `${window.devicePixelRatio || 1}|${window.screen?.width ?? 0}x${window.screen?.height ?? 0}|${window.screen?.colorDepth ?? 0}`;
    let lastDisplaySignature = displaySignature();

    const handleDisplayChange = () => {
      const sig = displaySignature();
      if (sig === lastDisplaySignature) return;
      lastDisplaySignature = sig;
      if (displayTimer !== null) window.clearTimeout(displayTimer);
      displayTimer = window.setTimeout(() => {
        displayTimer = null;
        if ((!active && !keepAliveWhenHidden) || document.visibilityState !== 'visible') return;
        // Ge Chromium tid att flytta videoplanet till den nya GPU-utgången och
        // verifiera sedan utfallet via samma hälsovakt — ingen onödig reload.
        lastHealthTime = v.currentTime;
        frozenTicks = 1;
        try {
          v.pause();
          attempt();
        } catch { /* best effort */ }
      }, 280);
    };


    healthTimer = window.setInterval(checkHealth, 1000);



    // `playing` betyder bara att Chromium har lämnat paused-läget; på en kall
    // extern skärm kan videoplanet fortfarande stå och tugga på första rutan.
    // Visa därför inte videon förrän tidslinjen faktiskt har avancerat flera
    // bildrutor. Postern täcker hela kallstarten utan blinkning eller ryck.
    let paintStartTime: number | null = null;
    const markPainted = () => {
      // Loop eller seek (t.ex. efter decoder-rebuild) kastar tillbaka
      // currentTime — utan denna nollställning kunde skillnaden bli negativ
      // för alltid och postern ligga kvar över en video som faktiskt spelar.
      if (paintStartTime === null || v.currentTime < paintStartTime) paintStartTime = v.currentTime;
      if (v.currentTime - paintStartTime >= 0.18) setFirstFramePainted(true);

    };

    const gestureOpts: AddEventListenerOptions = { passive: true };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('touchstart', resume, gestureOpts);
    window.addEventListener('pointerdown', resume, gestureOpts);
    window.addEventListener('scroll', resume, gestureOpts);
    window.addEventListener('resize', handleDisplayChange, { passive: true });
    window.visualViewport?.addEventListener('resize', handleDisplayChange, { passive: true });
    v.addEventListener('canplay', resume);
    v.addEventListener('loadeddata', resume);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('stalled', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('playing', onFirstStablePlay);
    v.addEventListener('timeupdate', markPainted);

    return () => {
      clearRetry();
      clearStall();
      clearCold();
      if (healthTimer !== null) window.clearInterval(healthTimer);
      if (displayTimer !== null) window.clearTimeout(displayTimer);
      if (geometryFrame !== null) window.cancelAnimationFrame(geometryFrame);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('touchstart', resume);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('scroll', resume);
      window.removeEventListener('resize', handleDisplayChange);
      window.visualViewport?.removeEventListener('resize', handleDisplayChange);
      v.removeEventListener('canplay', resume);
      v.removeEventListener('loadeddata', resume);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('stalled', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('playing', onFirstStablePlay);
      v.removeEventListener('timeupdate', markPainted);
    };
  }, [active, safePlay, coldGate, geometryGate, keepAliveWhenHidden]);





  return (
    <motion.div
      initial={instant ? false : { opacity: 0, y: 40, scale: 0.94 }}
      whileInView={instant ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={instant ? undefined : { once: true, amount: 0.2 }}
      transition={instant ? undefined : { duration: 1.1, ease }}
      style={widthPx ? { width: `${widthPx}px`, maxWidth: '100%' } : undefined}
      className={`relative mx-auto ${widthPx ? '' : 'w-full max-w-[190px] sm:max-w-[215px] md:max-w-[230px] lg:max-w-[260px] xl:max-w-[285px]'} ${className}`}
    >



      {/* Sidoknappar — måtten är hämtade från en iPhone 16 Pro och uttrycks i
          procent så att de skalar med telefonen istället för att bli klumpiga
          2px-klossar på små storlekar.
          Vänster: Action (≈15.8%), volym upp (≈21.6%), volym ner (≈28.2%).
          Höger: Power (≈25.5%, ca 9% hög). Utsticket är ~0.8% av bredden. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -left-[0.8%] top-[14.9%] h-[2.8%] w-[0.8%] rounded-l-[2px] bg-gradient-to-b from-[#7e7a74] to-[#4f4c48]" />
        <span className="absolute -left-[0.8%] top-[20.4%] h-[4.9%] w-[0.8%] rounded-l-[2px] bg-gradient-to-b from-[#7e7a74] to-[#4f4c48]" />
        <span className="absolute -left-[0.8%] top-[26.6%] h-[4.9%] w-[0.8%] rounded-l-[2px] bg-gradient-to-b from-[#7e7a74] to-[#4f4c48]" />
        <span className="absolute -right-[0.8%] top-[24.1%] h-[7.9%] w-[0.8%] rounded-r-[2px] bg-gradient-to-b from-[#7e7a74] to-[#4f4c48]" />
      </div>


      {/* Titanchassi — behåll borstad metall, men klipp bort den sista
          subpixeln längst ned som annars kan ritas som en horisontell kant. */}
      <div
        className="relative rounded-[13.5%/6.0%] p-[1.5px]"
        style={{
          background:
            'linear-gradient(158deg, #4a4844 0%, #3a3835 22%, #2b2a27 48%, #34322f 66%, #232220 86%, #1b1a18 100%)',
          boxShadow: '0 22px 52px -34px rgba(0, 0, 0, 0.72)',
          clipPath: 'inset(0 0 1.2px 0 round 13.5% / 6.0%)',
          transform: 'translateZ(0)',
        }}
      >
        {/* Svart ram runt skärmen */}
        {/* Svart ram runt skärmen — iPhone 16 Pro har ~2 mm ram på 71.5 mm
            bredd ≈ 2.6 %. Tidigare 3.2 % gjorde chassit "tjockt" och mindre
            iPhone-likt. */}
        <div className="relative rounded-[13.3%/5.9%] bg-[#050505] p-[2.6%]">
          {/* Skärm */}
          <div
            className="relative overflow-hidden rounded-[11.2%/4.8%] bg-black"

            style={{ aspectRatio: ASPECT }}
          >
            {/* Posterlager: ritas i samma frame som layouten (till skillnad från
                <video poster> som Safari ibland håller tillbaka) och fasas ut
                mjukt först när videon faktiskt spelar — det tar bort blixten
                mellan stillbild och rörlig bild på Windows. */}
            {posterVisible && (
              <img
                src={posterAsset.url}
                alt=""
                aria-hidden
                decoding="sync"
                loading="eager"
                {...({ fetchpriority: 'high' } as Record<string, string>)}
                className={cn(
                  'pointer-events-none absolute inset-0 h-full w-full object-cover',
                  posterTransition,
                  firstFramePainted ? 'opacity-0' : 'opacity-100'
                )}
                style={{ zIndex: 1 }}
              />
            )}
            <video
              ref={videoRef}
              autoPlay={!coldGate}
              loop
              muted
              playsInline
              preload="auto"
              poster={posterAsset.url}
              aria-label="Demo av Parium-appen för jobbsökare"
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                // OBS: ingen CSS-`filter` här. En filter-property på ett
                // <video> tvingar Chrome/Edge på Windows bort från den
                // hårdvaruaccelererade video-overlayen och varje bildruta måste
                // då komposit-renderas → hackig uppspelning på laptops utan
                // dedikerad GPU.
              }}
            >
              {visibleSources.map((s) => (
                <source key={s.src} src={s.src} type={s.type} />
              ))}

            </video>


            {/* Statiskt statusfält — täcker hela inspelningens statusrad (klocka,
                wifi, batteri och iOS inspelningsindikator) med appens exakta
                bakgrundsfärg och ritar en helt stilla egen rad ovanpå. Signalstaplarna
                är borttagna eftersom de kapades på vissa skärmstorlekar. */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-[6.6%] bg-[#01182f]"
              style={{ zIndex: 3 }}
            >
              <div className="flex h-full items-center justify-between px-[9.5%] text-[6px] font-semibold leading-none text-white sm:text-[7px] md:text-[7.5px] lg:text-[8px] xl:text-[9px]">
                <span className="tabular-nums tracking-[-0.02em]">19:41</span>
                <span className="flex items-center gap-[0.35em]">
                  {/* Wifi */}
                  <svg viewBox="0 0 16 12" className="h-[0.95em] w-auto" fill="currentColor">
                    <path d="M8 11.2 5.9 8.9a3 3 0 0 1 4.2 0L8 11.2Z" />
                    <path d="M8 6.1c-1.5 0-2.9.6-3.9 1.6l-1.3-1.4A7.2 7.2 0 0 1 8 4.1c2 0 3.9.8 5.2 2.2l-1.3 1.4A5.4 5.4 0 0 0 8 6.1Z" />
                    <path d="M8 2.1c-2.6 0-5 1-6.7 2.7L0 3.4A11.3 11.3 0 0 1 8 .1c3.1 0 6 1.3 8 3.3l-1.3 1.4A9.3 9.3 0 0 0 8 2.1Z" />
                  </svg>
                  {/* Batteri */}
                  <svg viewBox="0 0 26 12" className="h-[0.95em] w-auto">
                    <rect
                      x="0.6"
                      y="0.6"
                      width="22"
                      height="10.8"
                      rx="3"
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.5"
                      strokeWidth="1.2"
                    />
                    <rect x="2.4" y="2.4" width="18.4" height="7.2" rx="1.8" fill="currentColor" />
                    <path
                      d="M24.2 4.2c1 .4 1.4 1 1.4 1.8s-.4 1.4-1.4 1.8V4.2Z"
                      fill="currentColor"
                      fillOpacity="0.5"
                    />
                  </svg>
                </span>
              </div>
            </div>
            {/* Dynamic Island i normalt läge */}
            <div
              aria-hidden
              className="absolute left-1/2 top-[1.1%] h-[4.0%] w-[30%] -translate-x-1/2 rounded-full bg-black"
              style={{ zIndex: 4 }}
            />



            {/* Skärmreflex + inre kant — hålls diskret så kontrasten inte tappas */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{
                background:
                  'linear-gradient(115deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 20%, rgba(255,255,255,0) 42%)',
                boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.08)',
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default JobSeekerVideoShowcase;
