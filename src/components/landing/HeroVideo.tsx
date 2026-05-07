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
      if (!video.paused) return;
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };

    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.addEventListener('canplay', tryPlay, { once: true });
    }

    // Starta om videon när användaren kommer tillbaka till fliken/appen
    // (iOS Safari pausar och "fryser" ofta videon vid app-switch)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        try {
          video.currentTime = 0;
        } catch {}
        tryPlay();
      } else {
        video.pause();
      }
    };
    const handlePageShow = () => {
      try {
        video.currentTime = 0;
      } catch {}
      tryPlay();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handlePageShow);

    return () => {
      video.removeEventListener('canplay', tryPlay);
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
