import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

// Pick a lighter source on smaller screens for faster first-frame on slower
// desktops. Visual parity preserved (video is heavily darkened by overlays).
const pickSrc = () => {
  if (typeof window === 'undefined') return '/hero-video-720.mp4';
  const w = window.innerWidth * (window.devicePixelRatio || 1);
  return w >= 1800 ? '/hero-video.mp4' : '/hero-video-720.mp4';
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

    const tryPlay = () => {
      if (!video.paused && !video.ended) return;
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };

    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.addEventListener('canplay', tryPlay, { once: true });
    }

    // Watchdog: om videon stallar/wait:ar, försök återuppta automatiskt
    let lastTime = 0;
    let stuckCount = 0;
    const watchdog = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (video.paused || video.ended) {
        tryPlay();
        return;
      }
      if (video.currentTime === lastTime) {
        stuckCount++;
        if (stuckCount >= 2) {
          // Frusen i ~1s — knuffa igång igen utan att nollställa
          stuckCount = 0;
          try {
            video.play().catch(() => {});
          } catch {}
        }
      } else {
        stuckCount = 0;
        lastTime = video.currentTime;
      }
    }, 500);

    const handleStalled = () => tryPlay();

    // Starta om videon när användaren kommer tillbaka till fliken/appen.
    // Viktigt: nollställ ALDRIG currentTime om videon redan spelar — det
    // orsakar frys på iOS Safari. Bara starta uppspelning om den är pausad.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        tryPlay();
      } else {
        video.pause();
      }
    };
    const handlePageShow = () => {
      tryPlay();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handlePageShow);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('waiting', handleStalled);
    video.addEventListener('suspend', handleStalled);

    return () => {
      window.clearInterval(watchdog);
      video.removeEventListener('canplay', tryPlay);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('waiting', handleStalled);
      video.removeEventListener('suspend', handleStalled);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handlePageShow);
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
          disableRemotePlayback
          className="absolute inset-0 h-full w-full object-cover"
        />
      </motion.div>
      <div className="absolute inset-0 bg-black/45 md:bg-black/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60 md:from-black/25 md:via-transparent md:to-black/55 pointer-events-none" />
    </div>
  );
};

export default HeroVideo;
