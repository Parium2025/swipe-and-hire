import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Premium hero background video.
 * - Autoplays muted/inline (iOS/Android safe)
 * - Recovers from freezes (visibility, stalled, suspend, pause)
 * - Watchdog: detects stuck currentTime and restarts playback
 * - Fades in only when first frame is actually painted
 */
const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let watchdog: number | undefined;
    let lastTime = 0;
    let stuckCount = 0;

    const safePlay = () => {
      if (cancelled || !video) return;
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay blocked — retry on first user gesture
          const retry = () => {
            video.play().catch(() => {});
            window.removeEventListener('pointerdown', retry);
            window.removeEventListener('touchstart', retry);
            window.removeEventListener('keydown', retry);
          };
          window.addEventListener('pointerdown', retry, { once: true });
          window.addEventListener('touchstart', retry, { once: true });
          window.addEventListener('keydown', retry, { once: true });
        });
      }
    };

    const handleCanPlay = () => {
      setReady(true);
      safePlay();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && video.paused) {
        safePlay();
      }
    };

    const handleStall = () => {
      // Force reload of the current playback
      try {
        const t = video.currentTime;
        video.load();
        video.currentTime = t || 0;
        safePlay();
      } catch {
        safePlay();
      }
    };

    // Watchdog — if currentTime doesn't advance while page is visible, recover
    watchdog = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (video.paused || video.ended) {
        safePlay();
        return;
      }
      if (video.readyState < 2) return;
      if (video.currentTime === lastTime) {
        stuckCount += 1;
        if (stuckCount >= 3) {
          stuckCount = 0;
          handleStall();
        }
      } else {
        stuckCount = 0;
        lastTime = video.currentTime;
      }
    }, 1000);

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleCanPlay);
    video.addEventListener('stalled', handleStall);
    video.addEventListener('suspend', () => safePlay());
    video.addEventListener('pause', () => {
      if (document.visibilityState === 'visible') safePlay();
    });
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('pageshow', handleVisibility);

    // Kick playback immediately
    safePlay();

    return () => {
      cancelled = true;
      if (watchdog) window.clearInterval(watchdog);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleCanPlay);
      video.removeEventListener('stalled', handleStall);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('pageshow', handleVisibility);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-background">
      <motion.video
        ref={videoRef}
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 1.06 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        src="/hero-video.mp4"
        autoPlay
        muted
        loop
        playsInline
        {...({ 'webkit-playsinline': 'true', 'x5-playsinline': 'true' } as Record<string, string>)}
        disablePictureInPicture
        disableRemotePlayback
        controls={false}
        preload="auto"
        poster=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Darkening overlays */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />
    </div>
  );
};

export default HeroVideo;
