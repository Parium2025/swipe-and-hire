import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

// Pick a lighter source on smaller screens for faster first-frame on slower
// desktops. Visual parity preserved (video is heavily darkened by overlays).
const pickSrc = () => {
  if (typeof window === 'undefined') return '/hero-video-720.mp4';
  const w = window.innerWidth * (window.devicePixelRatio || 1);
  return w >= 1400 ? '/hero-video.mp4' : '/hero-video-720.mp4';
};

const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src] = useState<string>(pickSrc);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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

    const tryPlay = () => {
      if (cancelled || !video) return;
      if (!video.paused && !video.ended) return;
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay blocked — retry shortly. När användaren rör skärmen
          // kommer nästa play()-anrop att lyckas.
          if (retryTimer) window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(tryPlay, 400);
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

    const handlePlaying = () => startWatchdog();
    const handleStalled = () => tryPlay();
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
          src={src}
          poster="/hero-video-poster.jpg"
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          className="absolute inset-0 h-full w-full object-cover"
        />
      </motion.div>
      <div className="absolute inset-0 bg-black/45 md:bg-black/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60 md:from-black/25 md:via-transparent md:to-black/55 pointer-events-none" />
    </div>
  );
};

export default HeroVideo;
