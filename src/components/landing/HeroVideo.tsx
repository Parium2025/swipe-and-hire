import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Premium hero background video — bulletproof edition.
 * - Autoplays muted/inline on iOS, Android, desktop
 * - Recovers from freezes (visibility, stalled, suspend, pause)
 * - Capped retries to avoid infinite reload loops on broken streams
 * - Respects prefers-reduced-motion and Save-Data
 * - Falls back to static poster frame if all recovery fails
 */
const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Respect user/network preferences — show first frame, no looping playback
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const saveData =
      typeof navigator !== 'undefined' &&
      'connection' in navigator &&
      Boolean((navigator as any).connection?.saveData);

    if (prefersReducedMotion || saveData) {
      video.removeAttribute('autoplay');
      video.loop = false;
      video.preload = 'metadata';
      const showFrame = () => {
        try {
          video.currentTime = 0.1;
        } catch {
          /* noop */
        }
        setReady(true);
      };
      video.addEventListener('loadedmetadata', showFrame, { once: true });
      return () => video.removeEventListener('loadedmetadata', showFrame);
    }

    let cancelled = false;
    let watchdog: number | undefined;
    let lastTime = 0;
    let stuckTicks = 0;
    let recoveryAttempts = 0;
    const MAX_RECOVERY = 4;

    const gestureCleanups: Array<() => void> = [];
    const cleanupGestures = () => {
      while (gestureCleanups.length) gestureCleanups.pop()?.();
    };

    const armGestureRetry = () => {
      if (cancelled) return;
      const retry = () => {
        cleanupGestures();
        if (cancelled) return;
        video.play().catch(() => {});
      };
      const opts: AddEventListenerOptions = { once: true, passive: true };
      window.addEventListener('pointerdown', retry, opts);
      window.addEventListener('touchstart', retry, opts);
      window.addEventListener('keydown', retry, opts);
      gestureCleanups.push(
        () => window.removeEventListener('pointerdown', retry),
        () => window.removeEventListener('touchstart', retry),
        () => window.removeEventListener('keydown', retry)
      );
    };

    const safePlay = () => {
      if (cancelled || !video) return;
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => armGestureRetry());
      }
    };

    const handleCanPlay = () => {
      setReady(true);
      recoveryAttempts = 0;
      safePlay();
    };

    const handleVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === 'visible' && video.paused && !failed) {
        safePlay();
      }
    };

    const recover = () => {
      if (cancelled || failed) return;
      if (recoveryAttempts >= MAX_RECOVERY) {
        // Give up gracefully — keep last visible frame
        setFailed(true);
        if (watchdog) {
          window.clearInterval(watchdog);
          watchdog = undefined;
        }
        return;
      }
      recoveryAttempts += 1;
      try {
        const t = video.currentTime;
        video.load();
        if (Number.isFinite(t)) video.currentTime = t;
      } catch {
        /* noop */
      }
      safePlay();
    };

    watchdog = window.setInterval(() => {
      if (cancelled || failed) return;
      if (document.visibilityState !== 'visible') return;
      if (video.paused || video.ended) {
        safePlay();
        return;
      }
      if (video.readyState < 2) return;
      if (video.currentTime === lastTime) {
        stuckTicks += 1;
        if (stuckTicks >= 3) {
          stuckTicks = 0;
          recover();
        }
      } else {
        stuckTicks = 0;
        recoveryAttempts = 0;
        lastTime = video.currentTime;
      }
    }, 1000);

    const handleStall = () => recover();
    const handleError = () => recover();
    const handlePause = () => {
      if (document.visibilityState === 'visible' && !failed) safePlay();
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleCanPlay);
    video.addEventListener('stalled', handleStall);
    video.addEventListener('error', handleError);
    video.addEventListener('suspend', () => safePlay());
    video.addEventListener('pause', handlePause);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('pageshow', handleVisibility);

    safePlay();

    return () => {
      cancelled = true;
      if (watchdog) window.clearInterval(watchdog);
      cleanupGestures();
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleCanPlay);
      video.removeEventListener('stalled', handleStall);
      video.removeEventListener('error', handleError);
      video.removeEventListener('pause', handlePause);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('pageshow', handleVisibility);
    };
  }, [failed]);

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
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Darkening overlays */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />
    </div>
  );
};

export default HeroVideo;
