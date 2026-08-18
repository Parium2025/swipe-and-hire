import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useDevice } from '@/hooks/use-device';
import { useTouchCapable } from '@/hooks/useInputCapability';
import { Play, Pause } from 'lucide-react';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { fetchPriority } from '@/lib/fetchPriority';
import {
  acquireProfileVideoDecoder,
  releaseProfileVideoDecoder,
  shouldReleaseDecoderOnStop,
} from '@/lib/profileVideoDecoders';

interface ProfileVideoProps {
  videoUrl: string;
  coverImageUrl?: string;
  /** Automatgenererad posterbild ur videon. Används när ingen cover finns. */
  posterUrl?: string | null;
  alt?: string;
  className?: string;
  userInitials?: string;
  showCountdown?: boolean; // Show countdown timer (default: true for employer view)
  showProgressBar?: boolean; // Show progress/scrubbing bar on hover (default: true)
  countdownVariant?: 'default' | 'compact' | 'preview' | 'circle'; // 'compact' for Min Profil, 'preview' for Förhandsgranska Profil, 'circle' for round avatars, 'default' elsewhere
  onPlayingChange?: (isPlaying: boolean) => void; // Callback when playing state changes
  onRemainingChange?: (remaining: number | null) => void; // Callback with remaining seconds
  onClick?: (e: React.MouseEvent) => void; // Custom click handler (bypasses default play behavior)
  disablePlayback?: boolean; // When true, clicking does nothing (just shows thumbnail)
  forceTouchMode?: boolean; // Force touch-style controls even on mouse devices (used in previews)
}

const ProfileVideo = ({ videoUrl, coverImageUrl, posterUrl, alt = "Profile video", className = "", userInitials = "?", showCountdown = true, showProgressBar = true, countdownVariant = 'default', onPlayingChange, onRemainingChange, onClick, disablePlayback = false, forceTouchMode = false }: ProfileVideoProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  // Unik nyckel i den globala dekoder-budgeten för profilvideor.
  const decoderTokenRef = useRef<symbol>(Symbol('profile-video'));
  const device = useDevice();
  const isMobile = device === 'mobile';
  const isTouchDevice = useTouchCapable();
  const effectiveIsTouchDevice = forceTouchMode || isTouchDevice;

  // Preload cover image if provided (videoUrl and coverImageUrl are now pre-signed by parent)
  const coverImages = useMemo(() => {
    return coverImageUrl ? [coverImageUrl] : [];
  }, [coverImageUrl]);
  
  useImagePreloader(coverImages, { priority: 'high' });

  // Update countdown timer when video is playing
  useEffect(() => {
    if (!isPlaying || !videoRef.current) {
      setRemainingSeconds(null);
      return;
    }

    const updateTime = () => {
      if (videoRef.current) {
        const remaining = Math.ceil(videoRef.current.duration - videoRef.current.currentTime);
        const value = remaining > 0 ? remaining : 0;
        setRemainingSeconds(value);
        onRemainingChange?.(value);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 100);

    return () => {
      clearInterval(interval);
      setRemainingSeconds(null);
      onRemainingChange?.(null);
    };
  }, [isPlaying]);

  // Notify parent when playing state changes
  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  // Cleanup when component unmounts - reset video and clear all states
  useEffect(() => {
    const token = decoderTokenRef.current;
    return () => {
      releaseProfileVideoDecoder(token);
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          // Vissa WebKit-versioner kastar InvalidStateError om metadata
          // inte hunnit laddas när currentTime sätts.
          if (videoRef.current.readyState >= 1) videoRef.current.currentTime = 0;
        } catch {
          // ignorera städfel vid unmount
        }
      }
      setIsPlaying(false);
      setShowVideo(false);
      setProgress(0);
      setControlsVisible(false);
      setIsDragging(false);
    };
  }, []);

  /** Stoppar uppspelning och frigör dekodern på plattformar med liten pool. */
  const stopPlayback = (hideVideo: boolean) => {
    releaseProfileVideoDecoder(decoderTokenRef.current);
    setIsPlaying(false);
    if (hideVideo) setShowVideo(false);
    const el = videoRef.current;
    if (!el) return;
    try {
      el.pause();
      if (el.readyState >= 1) el.currentTime = 0;
      if (shouldReleaseDecoderOnStop()) {
        // pause() räcker inte på Windows/Android – elementet håller kvar
        // hårdvarudekodern. load() släpper den tillbaka till poolen.
        el.load();
      }
    } catch {
      // ignorera – elementet kan vara på väg att avmonteras
    }
  };

  // Remove hover-based autoplay to avoid flicker; play only on explicit tap/click
  // (Keeping function names removed to simplify behavior)

  const handleTap = async (e?: React.MouseEvent) => {
    // If playback is disabled, do nothing (just act as thumbnail)
    if (disablePlayback) return;
    
    // If custom onClick is provided, use that instead
    if (onClick && e) {
      onClick(e);
      return;
    }
    // Do nothing if we don't have a playable URL yet
    if (!videoUrl) return;

    if (!isPlaying) {
      setShowVideo(true);
      setIsPlaying(true);
      // Ta en plats i dekoder-budgeten; äldsta profilvideon pausas vid behov.
      acquireProfileVideoDecoder(decoderTokenRef.current, () => stopPlayback(!effectiveIsTouchDevice));
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = 0;
          const playPromise = videoRef.current.play();
          if (playPromise && typeof (playPromise as any).catch === 'function') {
            await (playPromise as Promise<void>);
          }
        } catch (err) {
          // As a fallback (some browsers block unmuted play), try muted
          try {
            videoRef.current.muted = true;
            await videoRef.current.play();
          } catch (mutedPlayError) {
            console.warn('Failed to play video even when muted:', mutedPlayError);
            // Fastna inte i ett "spelar"-läge som visar en tom ram.
            stopPlayback(true);
          }
        }
      }
    } else {
      stopPlayback(true);
    }
  };
  const handleVideoEnd = () => {
    stopPlayback(!effectiveIsTouchDevice);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) {
      setProgress(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleVideoError = () => {
    console.error('Video playback error');
  };

  // Sökning sker via Pointer Events så att mus, touch och penna beter sig
  // identiskt (mouse-only gjorde progressbaren odragbar på iOS/Android).
  const seekToClientX = (clientX: number) => {
    if (!progressBarRef.current || !videoRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;

    videoRef.current.currentTime = newTime;
    setProgress(newTime);
  };

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture saknas i äldre webbläsare — global fallback nedan
    }
    seekToClientX(e.clientX);
  };

  const handleProgressPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    seekToClientX(e.clientX);
  };

  const handleProgressPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignorera
    }
  };

  const handleMouseEnter = () => {
    if (!effectiveIsTouchDevice) {
      setControlsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (!effectiveIsTouchDevice && !isDragging) {
      setControlsVisible(false);
    }
  };

  const handleTouchStart = () => {
    if (effectiveIsTouchDevice) {
      setControlsVisible(true);
      setTimeout(() => setControlsVisible(false), 3000);
    }
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
        if (!effectiveIsTouchDevice) {
          setControlsVisible(false);
        }
      };
      const handleGlobalPointerMove = (e: PointerEvent) => {
        seekToClientX(e.clientX);
      };

      document.addEventListener('pointerup', handleGlobalMouseUp);
      document.addEventListener('pointercancel', handleGlobalMouseUp);
      document.addEventListener('pointermove', handleGlobalPointerMove);
      return () => {
        document.removeEventListener('pointerup', handleGlobalMouseUp);
        document.removeEventListener('pointercancel', handleGlobalMouseUp);
        document.removeEventListener('pointermove', handleGlobalPointerMove);
      };
    }
  }, [isDragging, effectiveIsTouchDevice, duration]);

  // Visa alltid omslagsbild/initialer medan URL:er signeras för att undvika blink


  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ contain: 'paint' }}
      // When playback is disabled, let events bubble up to parent (e.g., dropdown trigger)
      // Otherwise, stop propagation to allow inline playback without triggering dropdown
      onPointerDown={disablePlayback ? undefined : (e) => e.stopPropagation()}
      onMouseDown={disablePlayback ? undefined : (e) => e.stopPropagation()}
      onClick={disablePlayback ? undefined : (e) => handleTap(e)}
      onMouseEnter={disablePlayback ? undefined : handleMouseEnter}
      onMouseLeave={disablePlayback ? undefined : handleMouseLeave}
      onTouchStart={disablePlayback ? undefined : handleTouchStart}
    >
      {/* Cover image or poster frame - always mounted, fade only */}
      {(coverImageUrl || posterUrl) ? (
        <img 
          src={coverImageUrl || posterUrl || undefined} 
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}
          loading="eager"
          decoding="async"
          {...fetchPriority('high')}
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className={`w-full h-full bg-[hsl(210,35%,22%)] flex items-center justify-center text-white font-semibold text-2xl transition-opacity duration-300 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}
        >
          {userInitials}
        </div>
      )}
      
      {videoUrl && (
        <video 
          ref={videoRef}
          src={videoUrl}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
          loop={false}
          muted={false}
          playsInline
          preload="none"
          poster={coverImageUrl || posterUrl || undefined}
          onEnded={handleVideoEnd}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleVideoError}
        />
      )}
      
      {/* Play/Pause overlay for touch devices or preview variant */}
      {(effectiveIsTouchDevice || countdownVariant === 'preview') && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
            isPlaying
              ? (effectiveIsTouchDevice || countdownVariant === 'preview'
                  ? 'bg-transparent opacity-100'
                  : 'bg-black/20 opacity-0 hover:opacity-100')
              : 'bg-transparent opacity-0'
          }`}
          role="button"
          tabIndex={0}
          aria-label={isPlaying ? 'Pausa video' : 'Spela video'}
          onClick={(e) => {
            e.stopPropagation();
            handleTap();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              handleTap();
            }
          }}
        >
          {isPlaying ? (
            <Pause className="h-8 w-8 text-white" />
          ) : (
            <Play className="h-8 w-8 text-white" fill="none" />
          )}
        </div>
      )}
      
      {/* Video indicator - always visible when not playing */}
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center cursor-pointer">
          <Play className="h-6 w-6 text-white drop-shadow-lg" fill="none" />
        </div>
      )}

      {/* Countdown timer when video is playing */}
      {showCountdown && isPlaying && remainingSeconds !== null && (
        countdownVariant === 'circle' ? (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <span className="text-[11px] font-semibold leading-none text-white tabular-nums tracking-tight video-text-shadow">
              {remainingSeconds}s
            </span>
          </div>
        ) : (
          <div 
            className={`absolute font-bold text-white video-text-shadow ${
              countdownVariant === 'compact'
                ? 'top-2 right-[1.375rem] px-1 py-0.5 text-xs'
                : countdownVariant === 'preview'
                  ? 'top-5 right-5 md:top-3 md:right-7 px-1.5 py-0.5 text-sm md:text-sm'
                  : 'top-3 right-3 md:top-3 md:right-6 px-2 py-1 text-sm md:text-base'
            }`}
          >
            {remainingSeconds}s
          </div>
        )
      )}



      {/* Video progress bar */}
      {showProgressBar && duration > 0 && (
        <div 
          className={`absolute bottom-2 left-2 right-2 md:bottom-4 md:left-3 md:right-3 transition-opacity duration-300 ${
            (controlsVisible || isDragging || countdownVariant === 'preview') && isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            ref={progressBarRef}
            className="h-1.5 md:h-2 bg-white/40 backdrop-blur-sm cursor-pointer hover:h-2 hover:bg-white/50 md:hover:h-3 transition-all rounded-full overflow-hidden shadow-lg touch-none"
            onPointerDown={handleProgressPointerDown}
            onPointerMove={handleProgressPointerMove}
            onPointerUp={handleProgressPointerUp}
            onPointerCancel={handleProgressPointerUp}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="h-full bg-white transition-all rounded-full"
              style={{ width: `${(progress / duration) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileVideo;
