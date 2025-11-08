import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useDevice } from '@/hooks/use-device';
import { Play, Pause } from 'lucide-react';
import { convertToSignedUrl } from '@/utils/storageUtils';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const device = useDevice();
  const isMobile = device === 'mobile';

  // Convert URLs to signed URLs when they change
  useEffect(() => {
    const convertUrls = async () => {
      if (videoUrl) {
        const signed = await convertToSignedUrl(videoUrl);
        setSignedVideoUrl(signed);
      }
      
      if (coverImageUrl && coverImageUrl.trim()) {
        const signedCover = await convertToSignedUrl(coverImageUrl);
        setSignedCoverUrl(signedCover);
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
    </div>
  );
};

export default ProfileVideo;