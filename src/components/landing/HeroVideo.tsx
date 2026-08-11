import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import desktopAsset from '@/assets/hero-desktop.mp4.asset.json';
import mobileAsset from '@/assets/hero-mobile.mp4.asset.json';
import portraitAsset from '@/assets/hero-mobile-portrait-916-v4.mp4.asset.json';
import posterAsset from '@/assets/hero-poster.jpg.asset.json';
import posterPortraitAsset from '@/assets/hero-poster-portrait-916-v4.jpg.asset.json';
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
// Regeln är geometrisk, inte enhetsbaserad, så den täcker allt från 4"-telefon
// till 100"-TV: så snart viewporten är smalare än 16:9 skulle en landskapsfil
// behöva beskäras i sidled (= kapade huvuden). Då byter vi till 3:4-mastern.
const LANDSCAPE_MIN_RATIO = 1.2; // över 1:1, under 4:3 — 4:3-skärmar räknas som landskap

const isPortraitLayout = () => {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!w || !h) return false;
  return w / h < LANDSCAPE_MIN_RATIO;
};

// Landskap: så snart viewporten är BREDARE än 16:9 (laptop med browser-chrome,
// ultrawide, delad skärm) skalar object-cover efter bredden och kapar topp och
// botten lika mycket. Med `center center` är det exakt huvudena som ryker.
// object-position i procent styr FÖRDELNINGEN av bortfallet. För motiv där
// håret/hjälmen når källbildens överkant räcker inte en liten toppmarginal:
// 0 % låser källbildens absoluta överkant mot viewportens överkant och lägger
// ALL beskärning i botten. Då kan webbläsaren aldrig kapa huvudet.
const SOURCE_RATIO = 16 / 9;
const LANDSCAPE_TOP_BIAS = '0%';

const landscapeObjectPosition = () => {
  if (typeof window === 'undefined') return 'center center';
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!w || !h) return 'center center';
  // Smalare än källan → beskärningen sker i sidled, toppen är redan trygg.
  if (w / h <= SOURCE_RATIO) return 'center center';
  return `center ${LANDSCAPE_TOP_BIAS}`;
};

const pickHeroSrc = () => {
  if (typeof window === 'undefined') return mobileAsset.url;
  // Alla porträtt-/kvadratiska viewports (telefon, surfplatta, delad fönstervy)
  // får 3:4-mastern: full bredd utan sidobeskärning och minimal inzoomning.
  if (isPortraitLayout()) return portraitAsset.url;
  // Landskap: skala efter faktisk renderad bredd (CSS-px × DPR, tak 2×) så att
  // stora skärmar och TV får 1080p-mastern och små/svaga enheter den lätta.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderedWidth = window.innerWidth * dpr;
  const wantsHighRes = renderedWidth >= 1280;
  return wantsHighRes && !prefersLightweightVideo() && !prefersReducedData()
    ? desktopAsset.url
    : mobileAsset.url;
};


const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [skipVideo] = useState<boolean>(shouldSkipVideo);
  const [heroSrc, setHeroSrc] = useState<string>(pickHeroSrc);
  const [isPortrait, setIsPortrait] = useState<boolean>(isPortraitLayout);
  const [landscapePosition, setLandscapePosition] = useState<string>(landscapeObjectPosition);

  // Recompute source on resize/orientation change so the video adapts when a
  // phone is rotated or a tablet changes orientation. The browser handles the
  // source swap automatically via React re-render.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = () => {
      setHeroSrc(pickHeroSrc());
      setIsPortrait(isPortraitLayout());
      setLandscapePosition(landscapeObjectPosition());
    };
    window.addEventListener('resize', handle, { passive: true });
    window.addEventListener('orientationchange', handle, { passive: true });
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('orientationchange', handle);
    };
  }, []);

  // Att byta src på <source> gör INGENTING förrän video.load() körs — elementet
  // hamnar i networkState=NO_SOURCE och rutan blir svart. På mobil triggar
  // adressfältets in-/utfällning resize → källbyte → svart skärm mitt i klippet.
  // Vi laddar därför om dekodern explicit varje gång källan faktiskt ändras.
  const loadedSrcRef = useRef<string | null>(null);
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
        }).catch(() => {
          failCount++;
          // iOS Lågeffektläge kan blockera autoplay helt tills första touch.
          // Vi döljer native play UI via CSS och försöker igen vid touch/focus.
          if (retryTimer) window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(tryPlay, 600);
        });
      }
    };


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
        {/* Porträtt: källan är native 9:16, så videon fyller hela ytan
            full-bleed utan beskärning av huvuden och utan svart gradient.
            Landskap: videon fyller hela ytan (källan är redan 16:9). */}
        <div className="absolute inset-0 h-full w-full">
          <video
            ref={videoRef}
            muted
            autoPlay
            loop
            playsInline
            // Porträtt (mobil): filen är bara ~2 MB och Chrome/Android ignorerar
            // <link rel="preload" as="video">. Med "metadata" hann dekodern ta slut
            // på buffert → svart ruta mellan klippen. "auto" buffrar hela klippet.
            preload={isPortrait ? 'auto' : 'metadata'}
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload noplaybackrate nofullscreen"
            poster={isPortrait ? posterPortraitAsset.url : posterAsset.url}
            onContextMenu={(e) => e.preventDefault()}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            // Porträttkällan är native 9:16 → centrerad crop räcker; på riktigt
            // låga viewports (delad skärm) hålls huvudena kvar med lätt topp-bias.
            style={{ objectPosition: isPortrait ? 'center 45%' : landscapePosition }}
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
