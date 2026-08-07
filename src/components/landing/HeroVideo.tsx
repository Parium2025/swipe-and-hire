import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { prefersLightweightVideo, prefersReducedData } from '@/lib/videoPlatform';
import hero720 from '@/assets/landing/hero/hero-video-720.mp4.asset.json';
import heroFull from '@/assets/landing/hero/hero-video.mp4.asset.json';
import heroPoster from '@/assets/landing/hero/hero-video-poster.jpg.asset.json';

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
const pickHeroSrc = () => {
  if (typeof window === 'undefined') return hero720.url;
  const desktop = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
  // Windows/Android (och sparläge/svagt nät) får den lätta 720p-mastern även på
  // desktop: 6,3 MB + mjukvaruavkodning är exakt det som gör hero-videon hackig
  // där. Villkoret delas nu med galleriet via videoPlatform.ts så de inte glider isär.
  return desktop && !prefersLightweightVideo() && !prefersReducedData() ? heroFull.url : hero720.url;
};


const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [skipVideo] = useState<boolean>(shouldSkipVideo);
  const [heroSrc] = useState<string>(pickHeroSrc);
  // Ger upp helt och visar postern om videon inte går att spela. Bättre en
  // skarp stillbild än en sida som slåss med decodern i evighet.
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || skipVideo || gaveUp) return;

    // Säkerställ autoplay-krav direkt på DOM-nivå (iOS-kritisk)
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('autoplay', '');
    try { (video as any).disableRemotePlayback = true; } catch {}

    let cancelled = false;
    let retryTimer: number | null = null;

    /**
     * ALLT här är hårt budgeterat.
     *
     * Bakgrund: den gamla versionen kunde hamna i självförstärkande loopar —
     * `error` triggade `load()` som triggade `error` igen, och `suspend`
     * (som Chrome skickar varje gång bufferten är full, alltså helt normalt)
     * startade om en 500 ms-polling som anropade `play()` om och om igen.
     * Så länge videon spelade perfekt märktes inget; så fort en enda
     * range-request tog en paus — t.ex. efter några loopar — började
     * loopen mala och stal frames från hela sidan. Därför: räknare på
     * varje väg, och en definitiv slutstation (poster).
     */
    const MAX_PLAY_CALLS = 12;   // totalt antal play()-försök innan vi slutar
    const MAX_RELOADS = 2;       // hur många gånger källan får laddas om
    const MAX_WATCHDOG_RUNS = 4; // hur många gånger pollingen får startas
    const WATCHDOG_MAX_MS = 8000;

    let playCalls = 0;
    let reloads = 0;
    let watchdogRuns = 0;
    let playedOnce = false;

    const tryPlay = () => {
      if (cancelled || !video) return;
      if (!video.paused && !video.ended) return;
      if (playCalls >= MAX_PLAY_CALLS) return;
      playCalls++;
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          if (cancelled || playCalls >= MAX_PLAY_CALLS) return;
          if (retryTimer) window.clearTimeout(retryTimer);
          // Växande backoff istället för fast 600 ms-hamring.
          retryTimer = window.setTimeout(tryPlay, Math.min(4000, 500 * playCalls));
        });
      }
    };

    // Watchdog: kör bara i korta, tidsbegränsade pass när videon faktiskt
    // fastnat. Aldrig som permanent polling.
    let watchdog: number | null = null;
    let watchdogStartedAt = 0;
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
      if (watchdog !== null || cancelled) return;
      if (watchdogRuns >= MAX_WATCHDOG_RUNS) return;
      watchdogRuns++;
      watchdogStartedAt = Date.now();
      lastTime = video.currentTime;
      stuckCount = 0;
      healthyTicks = 0;
      watchdog = window.setInterval(() => {
        if (cancelled || !video) return stopWatchdog();
        // Hård tidsgräns — pollingen får aldrig leva vidare i bakgrunden.
        if (Date.now() - watchdogStartedAt > WATCHDOG_MAX_MS) return stopWatchdog();
        if (document.hidden) return;
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
            tryPlay();
          }
        } else {
          stuckCount = 0;
          lastTime = video.currentTime;
          healthyTicks++;
          if (healthyTicks >= 3) stopWatchdog();
        }
      }, 1000);
    };

    const onCanPlay = () => tryPlay();

    const handlePlaying = () => {
      playedOnce = true;
      // Uppspelningen lever → nollställ budgeten. En video som rullat i gång
      // ska inte straffas för ett tidigare hack, men varje ny hicka får
      // återigen bara ett begränsat antal försök.
      playCalls = 0;
      stopWatchdog();
    };

    // OBS: `suspend` lyssnas medvetet INTE på. Det eventet betyder "browsern
    // har slutat hämta data", vilket är normaltillståndet för en färdigbuffrad
    // video — inte ett fel.
    const handleStalled = () => {
      startWatchdog();
      tryPlay();
    };

    const handlePause = () => {
      // Ett enda försök att återuppta. Ingen watchdog, ingen loop.
      tryPlay();
    };

    let errorTimer: number | null = null;
    const handleError = () => {
      if (cancelled) return;
      if (reloads >= MAX_RELOADS) {
        // Slutstation: visa postern i stället för att fortsätta ladda om.
        stopWatchdog();
        setGaveUp(true);
        return;
      }
      reloads++;
      if (errorTimer) window.clearTimeout(errorTimer);
      errorTimer = window.setTimeout(() => {
        if (cancelled) return;
        try {
          video.load();
          playCalls = 0;
          tryPlay();
        } catch {
          setGaveUp(true);
        }
      }, 1200 * reloads);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (playedOnce) playCalls = 0;
        tryPlay();
      }
    };
    const handleResume = () => {
      if (playedOnce) playCalls = 0;
      tryPlay();
    };
    const handleFirstInteraction = () => {
      playCalls = 0;
      tryPlay();
    };

    if (video.readyState >= 2) tryPlay();
    video.addEventListener('loadeddata', onCanPlay);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('waiting', handleStalled);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true, once: true });
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('click', handleFirstInteraction, { once: true });

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (errorTimer) window.clearTimeout(errorTimer);
      stopWatchdog();
      video.removeEventListener('loadeddata', onCanPlay);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('waiting', handleStalled);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('click', handleFirstInteraction);
    };
  }, [skipVideo, gaveUp]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 h-full w-full"
      >
        <video
          ref={videoRef}
          muted
          autoPlay
          loop
          playsInline
          // preload="metadata" — videon hämtas ändå via <link rel="preload"> i index.html,
          // så vi behöver inte att <video>-elementet startar en parallell auto-fetch.
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate nofullscreen"
          poster={heroPoster.url}

          onContextMenu={(e) => e.preventDefault()}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        >
          {!skipVideo && !gaveUp && (
            /* Endast EN källa — samma URL som <link rel="preload"> i index.html,
               så browsern återanvänder samma fetch istället för att ladda två filer.
               Vid gaveUp tas källan bort helt: då står postern kvar och browsern
               slutar försöka dekoda, i stället för att mala i bakgrunden. */
            <source src={heroSrc} type="video/mp4" />
          )}

        </video>
      </motion.div>
      <div className="absolute inset-0 bg-black/45 md:bg-black/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60 md:from-black/25 md:via-transparent md:to-black/55 pointer-events-none" />
    </div>
  );
};

export default HeroVideo;
