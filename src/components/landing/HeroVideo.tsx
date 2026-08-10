import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  HERO_DESKTOP_QUERY,
  HERO_POSTER,
  HERO_VIDEO_1080,
  HERO_VIDEO_4K,
  heroFocusXAt,
  heroObjectPositionX,

  pickHeroSrc,
  prefersReducedMotion,
  shouldSkipHeroVideo,
} from '@/lib/heroVideoSource';


// Källval och sparlägesregler bor i src/lib/heroVideoSource.ts — samma modul som
// index.html verifieras mot vid build. Re-exporteras här för bakåtkompatibilitet.
export { HERO_VIDEO_4K, HERO_VIDEO_1080 };

const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Sparläge/2G, eller användare som bett om mindre rörelse → poster, ingen film.
  const [skipVideo] = useState<boolean>(() => shouldSkipHeroVideo() || prefersReducedMotion());
  const [heroSrc, setHeroSrc] = useState<string>(pickHeroSrc);

  // Dev-guard: om index.html preloadar en annan fil än den vi spelar hämtas två
  // videofiler och bara en används. Build-scriptet fångar statiska avvikelser,
  // det här fångar dem som bara uppstår i en viss runtime (t.ex. sparläge).
  useEffect(() => {
    if (!import.meta.env.DEV || skipVideo) return;
    const preloaded = document.querySelector<HTMLLinkElement>('link[rel="preload"][as="video"]');
    if (preloaded && new URL(preloaded.href, location.href).pathname !== new URL(heroSrc, location.href).pathname) {
      console.warn('[HeroVideo] preload i index.html matchar inte pickHeroSrc():', preloaded.href, '≠', heroSrc);
    }
  }, [heroSrc, skipVideo]);

  // Breakpoint-byte (extern skärm in/ur, fönster som dras mellan skärmar) ska
  // ge rätt master. Vi byter bara när matchMedia faktiskt ändras — aldrig på
  // varje resize — och återupptar från samma tidpunkt så bytet inte syns.
  useEffect(() => {
    if (skipVideo || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(HERO_DESKTOP_QUERY);
    const onChange = () => setHeroSrc((current) => {
      const next = pickHeroSrc();
      return next === current ? current : next;
    });
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [skipVideo]);

  // Källbytet kräver load() — annars fortsätter elementet spela gamla filen.
  // Vi hoppar första renderingen och behåller position + uppspelning.
  const appliedSrc = useRef<string | null>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || skipVideo) return;
    if (appliedSrc.current === null) {
      appliedSrc.current = heroSrc;
      return;
    }
    if (appliedSrc.current === heroSrc) return;
    appliedSrc.current = heroSrc;
    const resumeAt = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const restore = () => {
      try {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = Math.min(resumeAt, Math.max(0, video.duration - 0.1));
        }
      } catch { /* best effort */ }
      void video.play().catch(() => {});
    };
    video.addEventListener('loadedmetadata', restore, { once: true });
    try { video.load(); } catch { video.removeEventListener('loadedmetadata', restore); }
    return () => video.removeEventListener('loadedmetadata', restore);
  }, [heroSrc, skipVideo]);

  // Porträttsäkert utsnitt: 16:9-mastern beskärs hårt på BREDDEN i en smal
  // viewport (bara ~25 % av bilden syns). Med statisk `center` kapas personer
  // som står vid sidan i sin scen. Vi flyttar därför utsnittet per klipp, mjukt
  // interpolerat vid varje scenbyte så rörelsen aldrig syns som ett hopp.
  // Är ytan bredare än 16:9 sker ingen horisontell beskärning → vi rör inget.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || skipVideo || typeof window === 'undefined') return;

    let raf: number | null = null;
    let applied = -1;
    let ratio = 1;

    const measure = () => {
      const rect = video.getBoundingClientRect();
      const vw = video.videoWidth || 16;
      const vh = video.videoHeight || 9;
      if (rect.width <= 0 || rect.height <= 0) return;
      // object-cover: skalas efter höjden när ytan är smalare än videon.
      ratio = (rect.height * (vw / vh)) / rect.width;
      applied = -1;
    };

    const tick = () => {
      raf = window.requestAnimationFrame(tick);
      // Först vid kraftig beskärning (mobil/porträtt) finns något att rädda.
      // På desktop är utsnittet redan rätt — då rör vi inte bilden alls.
      const value = ratio >= 1.6
        ? heroObjectPositionX(heroFocusXAt(video.currentTime || 0), ratio)
        : 50;
      if (Math.abs(value - applied) < 0.1) return;
      applied = value;
      video.style.objectPosition = `${value.toFixed(2)}% 50%`;

    };

    const stop = () => {
      if (raf !== null) window.cancelAnimationFrame(raf);
      raf = null;
    };

    const start = () => {
      measure();
      stop();
      raf = window.requestAnimationFrame(tick);
    };

    start();
    video.addEventListener('loadedmetadata', start);
    window.addEventListener('resize', measure, { passive: true });
    window.visualViewport?.addEventListener('resize', measure, { passive: true });
    return () => {
      stop();
      video.removeEventListener('loadedmetadata', start);
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      video.style.objectPosition = '';
    };
  }, [skipVideo]);



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
        // Ingen pollning i bakgrundsflik: browsern strypar ändå timers och
        // varje tick kostar batteri utan att kunna åtgärda något.
        if (document.visibilityState !== 'visible') {
          stopWatchdog();
          return;
        }
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
          poster={HERO_POSTER}

          onContextMenu={(e) => e.preventDefault()}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        >
          {!skipVideo && (
            /* Endast EN källa — samma URL som <link rel="preload"> i index.html,
               så browsern återanvänder samma fetch istället för att ladda två filer. */
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
