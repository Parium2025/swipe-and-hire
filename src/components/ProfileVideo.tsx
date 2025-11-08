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
}

const ProfileVideo = ({ videoUrl, coverImageUrl, alt = "Profile video", className = "", userInitials = "?" }: ProfileVideoProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [signedCoverUrl, setSignedCoverUrl] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Remove hover-based autoplay to avoid flicker; play only on explicit tap/click
  // (Keeping function names removed to simplify behavior)

  const handleTap = () => {
    if (!isPlaying) {
      setShowVideo(true);
      setIsPlaying(true);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
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

  // Visa alltid omslagsbild/initialer medan URL:er signeras för att undvika blink


  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      onClick={handleTap}
    >
      {/* Cover image or poster frame - always mounted, fade only */}
      {signedCoverUrl ? (
        <img 
          src={signedCoverUrl} 
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}
          loading="eager"
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
        />
      )}
      
      {/* Play/Pause overlay for mobile */}
      {isMobile && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
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
      {isPlaying && remainingSeconds !== null && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-semibold">
          {remainingSeconds}s
        </div>
      )}
    </div>
  );
};

export default ProfileVideo;