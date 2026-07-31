import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

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
  if (typeof window === 'undefined') return '/hero-video-720.mp4';
  const desktop = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
  // Windows/Android (och sparläge) får den lätta 720p-mastern även på desktop:
  // 6,3 MB + mjukvaruavkodning är exakt det som gör hero-videon hackig där.
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const lightweight = /Windows NT|Android/i.test(ua);
  return desktop && !lightweight ? '/hero-video.mp4' : '/hero-video-720.mp4';
};


const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [skipVideo] = useState<boolean>(shouldSkipVideo);
  const [heroSrc] = useState<string>(pickHeroSrc);


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
    let failCount = 0;

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

    const startWatchdog = () => {
      if (watchdog !== null) return;
      lastTime = video.currentTime;
      stuckCount = 0;
      watchdog = window.setInterval(() => {
        if (!video) return;
        if (video.paused || video.ended) {
          tryPlay();
          return;
        }
        if (video.currentTime === lastTime) {
          stuckCount++;
          if (stuckCount >= 2) {
            stuckCount = 0;
            try { video.play().catch(() => {}); } catch {}
          }
        } else {
          stuckCount = 0;
          lastTime = video.currentTime;
        }
      }, 500);
    };

    const handlePlaying = () => {
      startWatchdog();
    };
    const handleStalled = () => {
      tryPlay();
    };
    const handleError = () => {
      // Försök ladda om källan vid fel
      try {
        video.load();
        tryPlay();
      } catch {}
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
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true, once: true });
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('click', handleFirstInteraction, { once: true });

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
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
          poster="/hero-video-poster.jpg"

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
