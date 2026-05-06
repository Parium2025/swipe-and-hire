import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Premium hero background video.
 * Original simple autoplay system — muted/inline so iOS Safari, Android & desktop autoplay.
 */
const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // iOS Safari: säkerställ muted/playsInline som DOM-property innan play().
    video.muted = true;
    video.defaultMuted = true;
    (video as any).playsInline = true;
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <motion.video
        ref={videoRef}
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        autoPlay
        muted
        loop
        playsInline
        {...({ 'webkit-playsinline': 'true', 'x5-playsinline': 'true' } as Record<string, string>)}
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        className="absolute inset-0 h-full w-full object-cover"
        style={{ pointerEvents: 'none' }}
      >
        <source src="/hero-video-720.mp4" type="video/mp4" media="(max-width: 768px)" />
        <source src="/hero-video.mp4" type="video/mp4" />
      </motion.video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
    </div>
  );
};

export default HeroVideo;
