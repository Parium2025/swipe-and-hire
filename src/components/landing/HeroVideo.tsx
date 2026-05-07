import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Säkerställ autoplay-krav direkt på DOM-nivå (iOS-kritisk)
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;
    if (video.paused) {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
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
          src="/hero-video.mp4"
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          className="absolute inset-0 h-full w-full object-cover"
        />
      </motion.div>
      <div className="absolute inset-0 bg-black/45 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60 pointer-events-none" />
    </div>
  );
};

export default HeroVideo;
