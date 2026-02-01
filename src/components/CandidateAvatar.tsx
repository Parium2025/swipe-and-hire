import React, { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ProfileVideo from "@/components/ProfileVideo";
import { useMediaUrl } from "@/hooks/useMediaUrl";

type CandidateAvatarProps = {
  profileImageUrl: string | null | undefined;
  videoUrl: string | null | undefined;
  isProfileVideo: boolean | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  onPlayingChange?: (isPlaying: boolean) => void;
  stopPropagation?: boolean;
};

function CandidateAvatarBase({ 
  profileImageUrl, 
  videoUrl, 
  isProfileVideo, 
  firstName, 
  lastName,
  onPlayingChange,
  stopPropagation = false
}: CandidateAvatarProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Use useMediaUrl hook properly at component level
  // These will generate signed URLs for private bucket files
  const resolvedImageUrl = useMediaUrl(profileImageUrl, 'profile-image');
  const resolvedVideoUrl = useMediaUrl(videoUrl, 'profile-video');
  
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const hasVideo = !!isProfileVideo && !!resolvedVideoUrl;
  const hasImage = !!resolvedImageUrl && !avatarError;

  // Reset error state when URL changes
  useEffect(() => {
    if (resolvedImageUrl) {
      setAvatarError(false);
      setImageLoaded(false);
    }
  }, [resolvedImageUrl]);

  // Debug logging for troubleshooting (remove in production)
  useEffect(() => {
    if (profileImageUrl && !resolvedImageUrl) {
      console.debug('[CandidateAvatar] Waiting for signed URL:', profileImageUrl);
    }
  }, [profileImageUrl, resolvedImageUrl]);

  const handleClick = stopPropagation ? (e: React.MouseEvent) => e.stopPropagation() : undefined;

  if (hasVideo) {
    return (
      <div onClick={handleClick}>
        <ProfileVideo
          videoUrl={resolvedVideoUrl!}
          coverImageUrl={resolvedImageUrl || undefined}
          userInitials={initials}
          alt="Kandidatvideo"
          className="h-10 w-10 ring-2 ring-inset ring-white/20 rounded-full"
          showCountdown={false}
          showProgressBar={false}
          onPlayingChange={onPlayingChange}
        />
      </div>
    );
  }

  return (
    <Avatar className="h-10 w-10 ring-2 ring-inset ring-white/20 transform-gpu">
      <AvatarImage 
        src={resolvedImageUrl || ''} 
        alt={`${firstName || ''} ${lastName || ''}`}
        loading="lazy"
        onError={() => setAvatarError(true)}
        onLoad={() => setImageLoaded(true)}
      />
      <AvatarFallback className="bg-white/20 text-white font-semibold" delayMs={150}>
        {initials || '?'}
      </AvatarFallback>
    </Avatar>
  );
}

export const CandidateAvatar = React.memo(CandidateAvatarBase, (prev, next) => {
  return (
    prev.profileImageUrl === next.profileImageUrl &&
    prev.videoUrl === next.videoUrl &&
    prev.isProfileVideo === next.isProfileVideo &&
    prev.firstName === next.firstName &&
    prev.lastName === next.lastName &&
    prev.onPlayingChange === next.onPlayingChange &&
    prev.stopPropagation === next.stopPropagation
  );
});

export default CandidateAvatar;
