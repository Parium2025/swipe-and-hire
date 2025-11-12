import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useDevice } from '@/hooks/use-device';
import { Play, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useImagePreloader } from '@/hooks/useImagePreloader';

interface ProfileVideoProps {
  videoUrl: string;
  coverImageUrl?: string;
  alt?: string;
  className?: string;
  userInitials?: string;
  showCountdown?: boolean; // Show countdown timer (default: true for employer view)
}

const ProfileVideo = ({ videoUrl, coverImageUrl, alt = "Profile video", className = "", userInitials = "?", showCountdown = true }: ProfileVideoProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [signedCoverUrl, setSignedCoverUrl] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const device = useDevice();
  const isMobile = device === 'mobile';

  // Generate signed URLs on-demand from storage paths
  useEffect(() => {
    let isMounted = true;
    
    const convertUrls = async () => {
      if (!isMounted) return;

      if (videoUrl) {
        try {
          if (videoUrl.startsWith('http')) {
            // Already a full URL
            setSignedVideoUrl(videoUrl);
          } else {
            // Storage path - generate public URL (profile-media is public bucket)
            const { data } = supabase.storage
              .from('profile-media')
              .getPublicUrl(videoUrl);
            setSignedVideoUrl(data?.publicUrl || videoUrl);
          }
        } catch {
          setSignedVideoUrl(videoUrl);
        }
      } else {
        setSignedVideoUrl(null);
      }
      
      if (coverImageUrl && coverImageUrl.trim()) {
        try {
          if (coverImageUrl.startsWith('http')) {
            // Already a full URL - could be from job-applications bucket
            // Use convertToSignedUrl for auto-bucket detection
            const { convertToSignedUrl } = await import('@/utils/storageUtils');
            const url = await convertToSignedUrl(coverImageUrl, 'job-applications', 86400);
            setSignedCoverUrl(url || coverImageUrl);
          } else {
            // Storage path - could be in profile-media or job-applications
            // Try profile-media first (public), then job-applications (private)
            const { data: profileData } = supabase.storage
              .from('profile-media')
              .getPublicUrl(coverImageUrl);
            
            // Check if it's likely a job-applications path (has UUID folder structure)
            if (coverImageUrl.includes('/') && coverImageUrl.match(/^[a-f0-9-]{36}\//)) {
              const { convertToSignedUrl } = await import('@/utils/storageUtils');
              const signedUrl = await convertToSignedUrl(coverImageUrl, 'job-applications', 86400);
              setSignedCoverUrl(signedUrl || profileData?.publicUrl || coverImageUrl);
            } else {
              setSignedCoverUrl(profileData?.publicUrl || coverImageUrl);
            }
          }
        } catch {
          setSignedCoverUrl(coverImageUrl);
        }
      } else {
        setSignedCoverUrl(null);
      }
    };
    
    convertUrls();
    
    return () => {
      isMounted = false;
    };
  }, [videoUrl, coverImageUrl]);

  // Förladdda cover-bilden i bakgrunden
  const coverImages = useMemo(() => {
    return signedCoverUrl ? [signedCoverUrl] : [];
  }, [signedCoverUrl]);
  
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
        setRemainingSeconds(remaining > 0 ? remaining : 0);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 100);

    return () => {
      clearInterval(interval);
      setRemainingSeconds(null);
    };
  }, [isPlaying]);

  // Cleanup when component unmounts - reset video and clear all states
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setShowVideo(false);
      setProgress(0);
      setControlsVisible(false);
      setIsDragging(false);
    };
  }, []);

  // Remove hover-based autoplay to avoid flicker; play only on explicit tap/click
  // (Keeping function names removed to simplify behavior)

  const handleTap = async () => {
    // Do nothing if we don't have a playable URL yet
    if (!signedVideoUrl) return;

    if (!isPlaying) {
      setShowVideo(true);
      setIsPlaying(true);
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
          } catch {}
        }
      }
    } else {
      setShowVideo(false);
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  };
  const handleVideoEnd = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    if (!isMobile) {
      setShowVideo(false);
    }
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

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!progressBarRef.current || !videoRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setProgress(newTime);
  };

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    handleProgressClick(e);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);
    handleProgressClick(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      setControlsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile && !isDragging) {
      setControlsVisible(false);
    }
  };

  const handleTouchStart = () => {
    if (isMobile) {
      setControlsVisible(true);
      setTimeout(() => setControlsVisible(false), 3000);
    }
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
        if (!isMobile) {
          setControlsVisible(false);
        }
      };
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!progressBarRef.current || !videoRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const newTime = percentage * duration;
        videoRef.current.currentTime = newTime;
        setProgress(newTime);
      };
      
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('mousemove', handleGlobalMouseMove);
      };
    }
  }, [isDragging, isMobile, duration]);

  // Visa alltid omslagsbild/initialer medan URL:er signeras för att undvika blink


  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ contain: 'paint' }}
      onClick={handleTap}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      {/* Cover image or poster frame - always mounted, fade only */}
      {signedCoverUrl ? (
        <img 
          src={signedCoverUrl} 
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-white font-semibold text-2xl transition-opacity duration-300 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}>
          {userInitials}
        </div>
      )}
      
      {signedVideoUrl && (
        <video 
          ref={videoRef}
          src={signedVideoUrl}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
          loop={false}
          muted={false}
          playsInline
          preload="metadata"
          poster={signedCoverUrl || undefined}
          onEnded={handleVideoEnd}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />
      )}
      
      {/* Play/Pause overlay for mobile */}
      {isMobile && (
        <div
          className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            handleTap();
          }}
        >
          {isPlaying ? (
            <Pause className="h-8 w-8 text-white" />
          ) : (
            <Play className="h-8 w-8 text-white" />
          )}
        </div>
      )}
      
      {/* Hover indicator for desktop */}
      {!isMobile && !isPlaying && (
        <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <Play className="h-6 w-6 text-white drop-shadow-lg" />
        </div>
      )}

      {/* Countdown timer when video is playing */}
      {showCountdown && isPlaying && remainingSeconds !== null && (
        <div className="absolute top-2 right-2 px-2 py-1 text-white text-xs font-semibold" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
          {remainingSeconds}s
        </div>
      )}

      {/* Video progress bar */}
      {duration > 0 && (
        <div 
          className={`absolute bottom-3 left-2 right-2 transition-opacity duration-300 ${
            (controlsVisible || isDragging) && isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseMove={handleProgressDrag}
        >
          <div
            ref={progressBarRef}
            className="h-1 bg-white/40 backdrop-blur-sm cursor-pointer hover:h-2 hover:bg-white/50 transition-all rounded-full overflow-hidden shadow-lg"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onClick={handleProgressClick}
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