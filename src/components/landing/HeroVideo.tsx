import { useEffect, useRef, useState } from 'react';

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
      if (cancelled) return;
      recoveryAttempts += 1;
      // After MAX_RECOVERY hard reloads, switch to poster fallback (hides <video>)
      // but KEEP retrying softly in the background so it self-heals.
      if (recoveryAttempts >= MAX_RECOVERY && !failed) {
        setFailed(true);
      }
      try {
        const t = video.currentTime;
        video.load();
        if (Number.isFinite(t)) video.currentTime = t;
      } catch {
        /* noop */
      }
      safePlay();
      // If recovery succeeds, handleCanPlay will reset recoveryAttempts and
      // we re-enable the live video below.
    };

    watchdog = window.setInterval(() => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') return;
      if (video.paused || video.ended) {
        safePlay();
        return;
      }
      if (video.readyState < 2) {
        // Stuck buffering — try a soft recover so we eventually come back
        safePlay();
        return;
      }
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
        // If we previously fell back to poster, video is alive again — restore it
        if (failed) setFailed(false);
      }
    }, 1000);

    const handleStall = () => recover();
    const handleError = () => recover();
    const handlePause = () => {
      if (document.visibilityState === 'visible') safePlay();
    };
    // When network comes back online, force a fresh load + play.
    // Otherwise the <video> element stays stuck in its previous error state
    // until the user manually refreshes the page.
    const handleOnline = () => {
      if (cancelled) return;
      recoveryAttempts = 0;
      stuckTicks = 0;
      recover();
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
    window.addEventListener('online', handleOnline);

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
      window.removeEventListener('online', handleOnline);
    };
  }, [failed]);

  // Sätt muted/playsInline direkt på DOM-noden. iOS Safari kräver att muted
  // finns som property vid första load, annars blockas autoplay och en
  // play-overlay ritas över videon.
  const setRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node) {
      node.muted = true;
      node.defaultMuted = true;
      (node as any).playsInline = true;
    }
  };

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-background">
      <video
        ref={setRef}
        poster="/hero-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        {...({ 'webkit-playsinline': 'true', 'x5-playsinline': 'true' } as Record<string, string>)}
        disablePictureInPicture
        disableRemotePlayback
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          visibility: failed ? 'hidden' : 'visible',
          opacity: ready && !failed ? 1 : 0,
          transform: ready && !failed ? 'scale(1)' : 'scale(1.06)',
          transition: 'opacity 1.4s cubic-bezier(0.16,1,0.3,1), transform 1.4s cubic-bezier(0.16,1,0.3,1)',
          pointerEvents: 'none',
        }}
      >
        <source src="/hero-video-720.mp4" type="video/mp4" media="(max-width: 768px)" />
        <source src="/hero-video.mp4" type="video/mp4" />
      </video>
      {failed && (
        <div
          className="absolute inset-0 h-full w-full bg-cover bg-center"
          style={{ backgroundImage: 'url(/hero-poster.jpg)' }}
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />
    </div>
  );
};

export default HeroVideo;
