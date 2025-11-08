import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useDevice } from '@/hooks/use-device';
import { Play, Pause, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { Progress } from '@/components/ui/progress';

interface ProfileVideoProps {
  videoUrl: string;
  coverImageUrl?: string;
  alt?: string;
  className?: string;
  userInitials?: string;
}

const ProfileVideo = ({ videoUrl, coverImageUrl, alt = "Profile video", className = "", userInitials = "?" }: ProfileVideoProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [signedCoverUrl, setSignedCoverUrl] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const device = useDevice();
  const isMobile = device === 'mobile';

  // Convert URLs to stable public URLs for caching
  useEffect(() => {
    const convertUrls = async () => {
      if (videoUrl) {
        // If already full URL, use it
        if (videoUrl.startsWith('http')) {
          setSignedVideoUrl(videoUrl);
        } else {
          // Get public URL from profile-media bucket
          const { data } = supabase.storage
            .from('profile-media')
            .getPublicUrl(videoUrl);
          if (data?.publicUrl) {
            setSignedVideoUrl(data.publicUrl);
          }
        }
      }
      
      if (coverImageUrl && coverImageUrl.trim()) {
        // If already full URL, use it
        if (coverImageUrl.startsWith('http')) {
          setSignedCoverUrl(coverImageUrl);
        } else {
          // Get public URL from profile-media bucket
          const { data } = supabase.storage
            .from('profile-media')
            .getPublicUrl(coverImageUrl);
          if (data?.publicUrl) {
            setSignedCoverUrl(data.publicUrl);
          }
        }
      } else {
        // Rensa cover-bild omedelbart när coverImageUrl är tom
        setSignedCoverUrl(null);
      }
    };
    
    convertUrls();
  }, [videoUrl, coverImageUrl]);

  // Förladdda cover-bilden i bakgrunden
  const coverImages = useMemo(() => {
    return signedCoverUrl ? [signedCoverUrl] : [];
  }, [signedCoverUrl]);
  
  useImagePreloader(coverImages, { priority: 'high' });

  // Update progress, countdown, and duration
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      const currentTime = video.currentTime;
      const duration = video.duration;
      
      if (duration > 0) {
        setProgress((currentTime / duration) * 100);
        setRemainingSeconds(Math.ceil(duration - currentTime));
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [signedVideoUrl]);

  // Remove hover-based autoplay to avoid flicker; play only on explicit tap/click
  // (Keeping function names removed to simplify behavior)

  const togglePlayPause = () => {
    if (!isPlaying) {
      setShowVideo(true);
      setIsPlaying(true);
      if (videoRef.current) {
        videoRef.current.play();
      }
    } else {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setProgress(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    if (!isMobile) {
      setShowVideo(false);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * videoRef.current.duration;
    
    videoRef.current.currentTime = newTime;
  };

  // Visa alltid omslagsbild/initialer medan URL:er signeras för att undvika blink


  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden group ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onClick={togglePlayPause}
    >
      {/* Cover image or poster frame */}
      {signedCoverUrl ? (
        <img 
          src={signedCoverUrl} 
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}
          loading="eager"
          fetchPriority="high"
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-white font-semibold text-2xl transition-opacity duration-500 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}>
          {userInitials}
        </div>
      )}
      
      {/* Video element */}
      {signedVideoUrl && (
        <video 
          ref={videoRef}
          src={signedVideoUrl}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
          loop={false}
          muted={false}
          playsInline
          preload="metadata"
          poster={signedCoverUrl || undefined}
          onEnded={handleVideoEnd}
        />
      )}
      
      {/* Center play/pause button - shows on hover or when paused */}
      <div 
        className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 ${
          !isPlaying || (showControls && isPlaying) ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ pointerEvents: 'none' }}
      >
        <div className="bg-white/90 backdrop-blur-sm rounded-full p-4 shadow-2xl transform transition-transform duration-200 hover:scale-110">
          {isPlaying ? (
            <Pause className="h-8 w-8 text-primary" />
          ) : (
            <Play className="h-8 w-8 text-primary ml-1" />
          )}
        </div>
      </div>

      {/* Bottom control bar - Spotify/YouTube style */}
      {signedVideoUrl && (
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent transition-all duration-300 ${
            isPlaying && (showControls || isMobile) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          <div 
            className="px-4 pt-8 pb-1 cursor-pointer group/progress"
            onClick={handleProgressClick}
          >
            <div className="relative h-1 bg-white/20 rounded-full overflow-hidden group-hover/progress:h-1.5 transition-all">
              <div 
                className="absolute top-0 left-0 h-full bg-white rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Control bar with time */}
          <div className="px-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                className="text-white hover:text-white/80 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>
              <Volume2 className="h-4 w-4 text-white/80" />
            </div>

            {/* Time display with countdown */}
            <div className="text-white text-xs font-medium">
              {remainingSeconds !== null && remainingSeconds > 0 ? (
                <span>{remainingSeconds}s kvar</span>
              ) : (
                <span>0:00</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileVideo;