import { useEffect, useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import hevcAsset from '@/assets/showcase-jobseeker.hevc.mp4.asset.json';
import hiCrispAsset from '@/assets/showcase-jobseeker-hi-crisp.mp4.asset.json';
import winCrispAsset from '@/assets/showcase-jobseeker-win-crisp.mp4.asset.json';
import posterAsset from '@/assets/showcase-jobseeker-poster.jpg.asset.json';
import windowsLiteAsset from '@/assets/showcase-jobseeker-windows-lite.mp4.asset.json';
import windowsSafe60Asset from '@/assets/showcase-jobseeker-windows-safe60.mp4.asset.json';
import fit432Asset from '@/assets/showcase-jobseeker-fit432.mp4.asset.json';
import { isAndroidDevice, isWindowsDevice, prefersReducedData } from '@/lib/videoPlatform';

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
// Native muted autoplay är stabilare än en egen buffertspärr i Chrome/Edge.
// Apple/iOS hade redan den här vägen och lämnas därmed helt oförändrat.
const usesBufferedStart = () => false;

/**
 * Windows/Chromium kan droppa frames när en <video>-overlay börjar spela medan
 * planet samtidigt flyttas/skalats av layouten. Det matchar beteendet här:
 * första rendern hackar, men efter att användaren scrollat bort och tillbaka är
 * telefonens geometri redan stabil och videon flyter perfekt.
 */
const usesStableGeometryStart = () => false;

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
            { src: windowsSafe60Asset.url, type: 'video/mp4; codecs="avc1.42C020"' },
          ]
        : isAndroidDevice()
          ? [
              // Androids H.264-hårdvaruväg är jämnare mellan olika GPU:er än VP9.
              { src: windowsLiteAsset.url, type: 'video/mp4' },
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
  const sourcesRef = useRef<ReturnType<typeof getSources> | null>(null);
  if (sourcesRef.current === null) sourcesRef.current = getSources(widthPx);
  const sources = sourcesRef.current;
  /**
   * Posterlager: <video poster> ritas inte alltid direkt i Safari/iOS — ramen
   * kan stå svart tills första bildrutan är dekodad. Ett riktigt <img> ovanpå
   * ritas i samma frame som layouten och fasas ut vid första `playing`.
   */
  const [firstFramePainted, setFirstFramePainted] = useState(false);
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

    // Kallstart: vänta in en riktig buffert innan första play(). Max 4 s, sedan
    // startar vi ändå så att telefonen aldrig blir stående på posterbilden.
    const COLD_TARGET_SECONDS = 2;
    const COLD_MAX_WAIT_MS = 4000;
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
      coldTimer = window.setInterval(() => {
        if (!active && !keepAliveWhenHidden) { clearCold(); return; }
        const ready = v.readyState >= 4 || aheadOf(v) >= COLD_TARGET_SECONDS;
        if (ready || Date.now() - startedAt >= COLD_MAX_WAIT_MS) {
          clearCold();
          warmRef.current = true;
          attempt();
        }
      }, 150);
    };

    /** Startpunkt: kallstartsspärr på Windows, direkt play överallt annars. */
    const kick = () => {
      waitForStableGeometry(() => {
        if (coldGate && !warmRef.current) startWhenBuffered();
        else attempt();
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
      v.removeEventListener('playing', onFirstStablePlay);
    };


    const gestureOpts: AddEventListenerOptions = { passive: true };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('touchstart', resume, gestureOpts);
    window.addEventListener('pointerdown', resume, gestureOpts);
    window.addEventListener('scroll', resume, gestureOpts);
    v.addEventListener('canplay', resume);
    v.addEventListener('loadeddata', resume);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('stalled', onWaiting);
    const markPainted = () => setFirstFramePainted(true);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('playing', onFirstStablePlay);
    v.addEventListener('playing', markPainted);
    v.addEventListener('timeupdate', markPainted);

    return () => {
      clearRetry();
      clearStall();
      clearCold();
      if (geometryFrame !== null) window.cancelAnimationFrame(geometryFrame);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('touchstart', resume);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('scroll', resume);
      v.removeEventListener('canplay', resume);
      v.removeEventListener('loadeddata', resume);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('stalled', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('playing', onFirstStablePlay);
      v.removeEventListener('playing', markPainted);
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
                först när videon faktiskt spelar. */}
            {!firstFramePainted && (
              <img
                src={posterAsset.url}
                alt=""
                aria-hidden
                decoding="sync"
                loading="eager"
                {...({ fetchpriority: 'high' } as Record<string, string>)}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            )}
            <video
              ref={videoRef}
              autoPlay
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
