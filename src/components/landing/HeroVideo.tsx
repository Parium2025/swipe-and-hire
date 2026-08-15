import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import desktopAsset from '@/assets/hero10-desktop.mp4.asset.json';
import landscapeLiteAsset from '@/assets/hero10-landscape-lite.mp4.asset.json';
import tabletAsset from '@/assets/hero11-tablet.mp4.asset.json';
import portraitAsset from '@/assets/hero12-portrait.mp4.asset.json';
import posterAsset from '@/assets/hero10-poster.jpg.asset.json';
import posterTabletAsset from '@/assets/hero11-poster-tablet.jpg.asset.json';
import posterPortraitAsset from '@/assets/hero12-poster-portrait.jpg.asset.json';
import { prefersLightweightVideo, prefersReducedData } from '@/lib/videoPlatform';


// Datasparläge eller 2G → hoppa över videoladdning helt och visa bara poster.
// Sparar 2,4–13 MB för användare i dåligt nät utan att förändra UX synbart.
const shouldSkipVideo = () => {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (!conn) return false;
  if (conn.saveData) return true;
  if (typeof conn.effectiveType === 'string' && /(^|-)2g$/.test(conn.effectiveType)) return true;
  return false;
};

// Välj EXAKT en källa. `media` på <source> inuti <video> respekteras inte
// tillförlitligt av Chrome/Edge → desktop hämtade både 6,3 MB och 2,4 MB och
// spelade sedan den lilla. Det åt hela nätverksbudgeten på Windows.
//
// Regeln är geometrisk, inte enhetsbaserad, och delar upp världen i tre nivåer
// så att object-cover aldrig behöver kapa mer än några få procent — och så att
// svarta ränder aldrig kan uppstå oavsett skärm:
//   ratio < 0.66            → telefon        → 9:16-master (1080×1920)
//   0.66 ≤ ratio < 1.25     → surfplatta/    → 3:4-master  (1200×1600)
//                              delad fönstervy
//   ratio ≥ 1.25            → laptop/TV      → 16:9-master (1920×1080 / 1280×720)
const PORTRAIT_MAX_RATIO = 0.66;
const TABLET_MAX_RATIO = 1.25;
// Riktiga telefoner har ofta ratio 0,66–0,72 när adressfältet är utfällt
// (t.ex. 393×580 = 0,68). Enbart ratio-regeln skickade dem till 3:4-spåret.
// MEN: bredden fick inte vara 820 px — en iPad i porträtt (768×1024 = 0,75,
// 820×1120 = 0,73) hamnade då i mobilspåret och fick 720×1280-mastern, som
// både är mjuk och betydligt hårdare beskuren. Telefonundantaget kräver nu
// BÅDE smal bredd och telefonliknande proportion, så surfplattor i porträtt
// alltid får 3:4-mastern (1200×1600).
const PHONE_MAX_WIDTH = 700;
const PHONE_MAX_RATIO = 0.72;

type HeroTier = 'portrait' | 'tablet' | 'landscape';

const getTier = (): HeroTier => {
  if (typeof window === 'undefined') return 'landscape';
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!w || !h) return 'landscape';
  const r = w / h;
  if (r < PORTRAIT_MAX_RATIO) return 'portrait';
  if (w <= PHONE_MAX_WIDTH && r < PHONE_MAX_RATIO) return 'portrait';
  if (r < TABLET_MAX_RATIO) return 'tablet';
  return 'landscape';
};

// Landskap: så snart viewporten är BREDARE än 16:9 (laptop med browser-chrome,
// ultrawide, delad skärm) skalar object-cover efter bredden och kapar topp och
// botten lika mycket. Med `center center` är det exakt huvudena som ryker.
// object-position i procent styr FÖRDELNINGEN av bortfallet. För motiv där
// håret/hjälmen når källbildens överkant räcker inte en liten toppmarginal:
// 0 % låser källbildens absoluta överkant mot viewportens överkant och lägger
// ALL beskärning i botten. Då kan webbläsaren aldrig kapa huvudet.
const SOURCE_RATIO = 16 / 9;
// Hur högt upp i källan vi låser bilden när viewporten är bredare än 16:9.
// 12 % = nästan all beskärning hamnar i botten (golv) → huvuden får alltid
// luft ovanför, precis som när viewporten är smalare än källan.
const LANDSCAPE_TOP_BIAS_MIN = 12;
const LANDSCAPE_TOP_BIAS_MAX = 50;

// Surfplatta stående: mastern är exakt 3:4 (1200×1600 = 0,75). En iPad i
// porträtt är 0,75 på pappret men webbläsarens adressfält/verktygsfält gör
// den faktiska viewporten kortare (t.ex. 820×1120 = 0,73). Då kapar
// object-cover några procent i HÖJD — och med `center` fördelas det lika
// mellan topp och botten, vilket är precis där huvudena ligger. 25 % lägger
// merparten av bortfallet i botten (golv/mark) så huvudet alltid får rum.
const TABLET_TOP_BIAS = '20%';

const landscapeObjectPosition = () => {
  if (typeof window === 'undefined') return 'center center';
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!w || !h) return 'center center';
  const ratio = w / h;
  // Smalare än källan → beskärningen sker i sidled, toppen är redan trygg.
  if (ratio <= SOURCE_RATIO) return 'center center';
  // Ju bredare viewport, desto mer höjd kapas → glid mjukt från 50 % (ingen
  // kapning) ner mot 12 % (nästan all kapning i botten) vid ~2.1:1 och bredare.
  const t = Math.min(1, (ratio - SOURCE_RATIO) / (2.1 - SOURCE_RATIO));
  const bias = LANDSCAPE_TOP_BIAS_MAX - t * (LANDSCAPE_TOP_BIAS_MAX - LANDSCAPE_TOP_BIAS_MIN);
  return `center ${bias.toFixed(1)}%`;
};


// Har vi en gång hämtat 1080p-mastern ligger den i cachen. Att nedgradera till
// lite-spåret när fönstret dras smalare vore då bara en extra nedladdning och en
// omstart av klippet — vi behåller den bättre filen resten av sessionen.
let landscapeHighResLatched = false;

const pickHeroSrc = () => {
  if (typeof window === 'undefined') return landscapeLiteAsset.url;
  const tier = getTier();
  if (tier === 'portrait') return portraitAsset.url;
  if (tier === 'tablet') return tabletAsset.url;
  if (landscapeHighResLatched) return desktopAsset.url;
  // Landskap: skala efter faktisk renderad bredd (CSS-px × DPR, tak 2×) så att
  // stora skärmar och TV får 1080p-mastern och små/svaga enheter den lätta.
  // iPad i liggande läge (1112–1194 CSS-px, dpr 2) ska alltid ha 1080p-mastern:
  // retina-panelen renderar ~2200 px och 720p-spåret syns som mjukt.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderedWidth = window.innerWidth * dpr;
  const isRetinaTabletOrLarger = dpr >= 2 && window.innerWidth >= 900;
  const wantsHighRes = renderedWidth >= 1280 || isRetinaTabletOrLarger;
  if (wantsHighRes && !prefersLightweightVideo() && !prefersReducedData()) {
    landscapeHighResLatched = true;
    return desktopAsset.url;
  }
  return landscapeLiteAsset.url;

};



const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [skipVideo] = useState<boolean>(shouldSkipVideo);
  const [heroSrc, setHeroSrc] = useState<string>(pickHeroSrc);
  const [tier, setTier] = useState<HeroTier>(getTier);
  const [landscapePosition, setLandscapePosition] = useState<string>(landscapeObjectPosition);
  // iOS Lågeffektläge blockerar autoplay. Safari ritar då sin egen play-knapp
  // ovanpå <video> (kan inte alltid CSS-döljas). Vi döljer hela videoelementet
  // och visar postern som vanlig <img> — ser ut som en still, inte en trasig spelare.
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);


  // Recompute source on resize/orientation change so the video adapts when a
  // phone is rotated or a tablet changes orientation.
  //
  // Två saker är kritiska här:
  //  1. object-position måste uppdateras direkt (ren CSS, ingen omladdning).
  //  2. Själva KÄLLAN får bara bytas när nivån faktiskt ändras, och först när
  //     användaren slutat ändra storlek. Varje källbyte kastar dekodern och
  //     startar om klippet från 0 — på mobil räcker adressfältets in-/utfällning
  //     eller ett drag i ett desktopfönster för att trigga det flera gånger i
  //     sekunden, vilket ger svarta blinkningar. Därför: CSS direkt, källbyte
  //     debounce:at till 250 ms efter sista resize-eventet.
  //     debounce:at till 250 ms efter sista resize-eventet.

  //
  //  3. UNDANTAG: byter NIVÅ (t.ex. telefon som roteras till liggande) måste
  //     källan bytas OMEDELBART. Annars spelas 9:16-mastern i en 16:9-viewport
  //     i en kvarts sekund, och object-cover hinner zooma sönder bilden /
  //     visa fel utsnitt. Nivåbyte = direkt, upplösningsbyte = debounce:at.
  const tierRef = useRef<HeroTier>(tier);
  tierRef.current = tier;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let settleTimer: number | null = null;
    const handle = () => {
      setLandscapePosition(landscapeObjectPosition());
      const nextTier = getTier();
      if (nextTier !== tierRef.current) {
        if (settleTimer !== null) {
          window.clearTimeout(settleTimer);
          settleTimer = null;
        }
        tierRef.current = nextTier;
        setTier(nextTier);
        setHeroSrc(pickHeroSrc());
        return;
      }
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        setHeroSrc(pickHeroSrc());
      }, 250);
    };
    window.addEventListener('resize', handle, { passive: true });
    window.addEventListener('orientationchange', handle, { passive: true });
    return () => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      window.removeEventListener('resize', handle);
      window.removeEventListener('orientationchange', handle);
    };
  }, []);

  // Att byta src på <source> gör INGENTING förrän video.load() körs — elementet
  // hamnar i networkState=NO_SOURCE och rutan blir svart. Vi laddar därför om

  // dekodern explicit varje gång källan faktiskt ändras — men ALDRIG vid första
  // renderingen: markup:en innehåller redan rätt <source>, och ett load() där
  // hade slängt bort browserns pågående preload-hämtning och startat om den.
  const loadedSrcRef = useRef<string | null>(heroSrc);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || skipVideo) return;
    if (loadedSrcRef.current === heroSrc) return;
    loadedSrcRef.current = heroSrc;
    try {
      video.load();
    } catch { /* best effort */ }
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [heroSrc, skipVideo]);



  useEffect(() => {
    const video = videoRef.current;
    if (!video || skipVideo) return;

    // Säkerställ autoplay-krav direkt på DOM-nivå (iOS-kritisk)
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('autoplay', '');
    // disableRemotePlayback as DOM attribute (not a standard React prop)
    try { (video as any).disableRemotePlayback = true; } catch {}

    let cancelled = false;
    let retryTimer: number | null = null;
    let errorRetryTimer: number | null = null;
    let decoderResetTimer: number | null = null;
    let resizeTimer: number | null = null;
    let failCount = 0;
    let errorCount = 0;
    let rebuilding = false;

    const tryPlay = () => {
      if (cancelled || !video) return;
      if (!video.paused && !video.ended) return;
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.then(() => {
          failCount = 0;
          setAutoplayBlocked(false);
        }).catch((err: unknown) => {
          failCount++;
          // iOS Lågeffektläge blockerar autoplay tills användaren interagerar.
          // Efter två misslyckade försök visar vi postern som stillbild i stället
          // för att låta Safari rita sin play-knapp ovanpå videon.
          const blocked = (err as { name?: string } | null)?.name === 'NotAllowedError';
          if (blocked && failCount >= 2) setAutoplayBlocked(true);
          if (retryTimer) window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(tryPlay, 600);
        });
      }
    };

    // Scroll räknas inte som gesture på iOS, men triggar ett nytt försök.
    // (touch/pointer/click hanteras redan av handleFirstInteraction längre ned.)
    const onUserGesture = () => tryPlay();
    document.addEventListener('scroll', onUserGesture, { passive: true });
    const onPlaying = () => setAutoplayBlocked(false);
    video.addEventListener('playing', onPlaying);




    // Försök spela direkt — väntar inte på canplay om vi redan har data
    if (video.readyState >= 2) {
      tryPlay();
    }
    // Lyssna alltid på loadeddata/canplay för säker första frame
    const onCanPlay = () => tryPlay();
    video.addEventListener('loadeddata', onCanPlay);
    video.addEventListener('canplay', onCanPlay);

    // Watchdog: starta först när videon faktiskt börjat spela för att
    // undvika false positives vid initial buffering.
    let watchdog: number | null = null;
    let lastTime = -1;
    let stuckCount = 0;
    let healthyTicks = 0;

    const stopWatchdog = () => {
      if (watchdog !== null) {
        window.clearInterval(watchdog);
        watchdog = null;
      }
    };

    const startWatchdog = () => {
      if (watchdog !== null) return;
      lastTime = video.currentTime;
      stuckCount = 0;
      healthyTicks = 0;
      watchdog = window.setInterval(() => {
        if (!video) return;
        if (video.paused || video.ended) {
          healthyTicks = 0;
          tryPlay();
          return;
        }
        if (video.currentTime === lastTime) {
          healthyTicks = 0;
          stuckCount++;
          if (stuckCount >= 2) {
            stuckCount = 0;
            rebuildDecoder();
          }
        } else {
          stuckCount = 0;
          lastTime = video.currentTime;
          healthyTicks++;
          // Efter ~5 s felfri uppspelning behövs ingen pollning längre.
          // Events (pause/stalled/waiting/playing) startar om den vid behov.
          if (healthyTicks >= 10) stopWatchdog();
        }
      }, 500);
    };

    // Ett GPU-/skärmbyte kan frysa Chromium-dekodern medan elementet fortfarande
    // rapporterar paused=false. play() gör då ingenting; load() skapar en ny
    // dekoder och vi återgår till samma position när metadata är redo.
    const rebuildDecoder = () => {
      if (cancelled || rebuilding || document.visibilityState !== 'visible') return;
      rebuilding = true;
      const resumeAt = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      const release = () => {
        video.removeEventListener('loadedmetadata', restore);
        if (decoderResetTimer !== null) window.clearTimeout(decoderResetTimer);
        decoderResetTimer = null;
        rebuilding = false;
      };
      const restore = () => {
        release();
        try {
          if (Number.isFinite(video.duration) && video.duration > 0) {
            video.currentTime = Math.min(resumeAt, Math.max(0, video.duration - 0.1));
          }
        } catch { /* best effort */ }
        errorCount = 0;
        lastTime = video.currentTime;
        tryPlay();
        startWatchdog();
      };
      video.addEventListener('loadedmetadata', restore, { once: true });
      decoderResetTimer = window.setTimeout(release, 5000);
      try {
        video.pause();
        video.load();
      } catch {
        release();
        tryPlay();
      }
    };

    const handlePlaying = () => {
      startWatchdog();
    };
    const handleStalled = () => {
      startWatchdog();
      tryPlay();
    };
    const handleError = () => {
      // Begränsad backoff förhindrar error → load-loop vid ett fladdrande GPU-byte.
      rebuilding = false;
      if (decoderResetTimer !== null) window.clearTimeout(decoderResetTimer);
      decoderResetTimer = null;
      if (errorCount >= 4 || cancelled) return;
      errorCount += 1;
      if (errorRetryTimer !== null) window.clearTimeout(errorRetryTimer);
      errorRetryTimer = window.setTimeout(rebuildDecoder, Math.min(500 * errorCount, 2000));
    };

    const handleDisplayChange = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        if (document.visibilityState !== 'visible') return;
        startWatchdog();
        try {
          video.pause();
          tryPlay();
        } catch { /* best effort */ }
      }, 350);
    };

    // Aldrig pausa på visibility — användaren vill att videon alltid rullar.
    // När fliken kommer tillbaka kan vissa browsers ha pausat ändå, så vi
    // återupptar. Vi nollställer ALDRIG currentTime.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tryPlay();
    };
    const handleResume = () => tryPlay();

    // Första user-interaction → garantera att autoplay-block släpper
    const handleFirstInteraction = () => {
      tryPlay();
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('waiting', handleStalled);
    video.addEventListener('suspend', handleStalled);
    video.addEventListener('pause', handleStalled); // återstarta om något pausar oss
    video.addEventListener('error', handleError);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('resize', handleDisplayChange, { passive: true });
    window.visualViewport?.addEventListener('resize', handleDisplayChange, { passive: true });
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true, once: true });
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('click', handleFirstInteraction, { once: true });

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (errorRetryTimer !== null) window.clearTimeout(errorRetryTimer);
      if (decoderResetTimer !== null) window.clearTimeout(decoderResetTimer);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (watchdog !== null) window.clearInterval(watchdog);
      document.removeEventListener('scroll', onUserGesture);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('loadeddata', onCanPlay);
      video.removeEventListener('canplay', onCanPlay);

      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('waiting', handleStalled);
      video.removeEventListener('suspend', handleStalled);
      video.removeEventListener('pause', handleStalled);
      video.removeEventListener('error', handleError);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('resize', handleDisplayChange);
      window.visualViewport?.removeEventListener('resize', handleDisplayChange);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('click', handleFirstInteraction);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black">
      <motion.div
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 h-full w-full"
      >
        {/* Mobil: den uppladdade byggarbetarvideon har porträttmotivet inbäddat
            i en 16:9-fil. object-cover beskär de svarta sidofälten och behåller
            personen centrerad. Landskap använder befintlig hero-master. */}
        <div className="absolute inset-0 h-full w-full">
          {/* Postern ligger ALLTID kvar som ett eget <img>-lager under videon.
              Poster-attributet ensamt räcker inte: i privat läge/kall cache
              (och när nätet är segt) hann Safari visa en helsvart <video>-ruta
              innan någon bild fanns. Med ett eget img-lager syns hero-bilden så
              fort 53 kB laddats, och videon tonas in ovanpå när den faktiskt
              målat sin första bildruta. */}
          <img
            src={tier === 'portrait' ? posterPortraitAsset.url : tier === 'tablet' ? posterTabletAsset.url : posterAsset.url}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${
              autoplayBlocked || skipVideo ? 'z-10' : 'z-0'
            }`}
            style={{ objectPosition: tier === 'landscape' ? landscapePosition : tier === 'tablet' ? `center ${TABLET_TOP_BIAS}` : 'center center' }}
          />

          <video
            ref={videoRef}
            aria-hidden="true"
            tabIndex={-1}
            muted
            autoPlay
            loop
            playsInline
            // Porträtt (mobil): Chrome/Android ignorerar
            // <link rel="preload" as="video">. Med "metadata" hann dekodern ta slut
            // på buffert → svart ruta mellan klippen. "auto" buffrar hela klippet.
            preload={tier === 'landscape' ? 'metadata' : 'auto'}
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload noplaybackrate nofullscreen"
            poster={tier === 'portrait' ? posterPortraitAsset.url : tier === 'tablet' ? posterTabletAsset.url : posterAsset.url}
            onContextMenu={(e) => e.preventDefault()}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            // Varje nivå har en master med nästan samma proportion som viewporten,
            // så object-cover kapar bara några procent — aldrig svarta ränder.
            style={{
              objectPosition: tier === 'landscape' ? landscapePosition : tier === 'tablet' ? `center ${TABLET_TOP_BIAS}` : 'center center',
              // Tona in först när en riktig bildruta finns — annars kan Safaris
              // tomma (svarta) videoyta lägga sig över posterlagret.
              opacity: videoPainted && !autoplayBlocked && !skipVideo ? 1 : 0,
              transition: 'opacity 240ms linear',
            }}
          >
            {!skipVideo && (
              /* Endast EN källa — samma URL som <link rel="preload"> i index.html,
                 så browsern återanvänder samma fetch istället för att ladda två filer. */
              <source src={heroSrc} type="video/mp4" />
            )}
          </video>
        </div>

      </motion.div>
      <div className="absolute inset-0 bg-black/45 md:bg-black/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60 md:from-black/25 md:via-transparent md:to-black/55 pointer-events-none" />
    </div>
  );

};

export default HeroVideo;
