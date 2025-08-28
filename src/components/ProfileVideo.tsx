import React, { useState, useRef, useEffect } from 'react';
import { useDevice } from '@/hooks/use-device';
import { Play, Pause } from 'lucide-react';
import { convertToSignedUrl } from '@/utils/storageUtils';

interface ProfileVideoProps {
  videoUrl: string;
  coverImageUrl?: string;
  alt?: string;
  className?: string;
}

const ProfileVideo = ({ videoUrl, coverImageUrl, alt = "Profile video", className = "" }: ProfileVideoProps) => {
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

  const handleMouseEnter = () => {
    if (!isMobile && !isPlaying) {
      setShowVideo(true);
      setIsPlaying(true);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setShowVideo(false);
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  };

  const handleTap = () => {
    if (isMobile) {
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

  // Show loading state while converting URLs
  if (!signedVideoUrl && videoUrl) {
    return (
      <div className={`${className} bg-muted/20 flex items-center justify-center rounded-lg animate-pulse`}>
        <span className="text-white/60 text-sm">Laddar video...</span>
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleTap}
    >
      {/* Cover image or poster frame */}
      {(!showVideo || !isPlaying) && signedCoverUrl && (
        <img 
          src={signedCoverUrl} 
          alt={alt}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
      )}
      
      {/* Video element */}
      {signedVideoUrl && (
        <video 
          ref={videoRef}
          src={signedVideoUrl}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            showVideo && isPlaying ? 'opacity-100' : 'opacity-0 absolute inset-0'
          }`}
          loop={false}
          muted={false}
          playsInline
          onEnded={handleVideoEnd}
          style={{ 
            display: showVideo || !signedCoverUrl ? 'block' : 'none' 
          }}
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