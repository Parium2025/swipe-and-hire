import React, { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ProfileVideo from "@/components/ProfileVideo";
import { useMediaUrl } from "@/hooks/useMediaUrl";

type CandidateAvatarProps = {
  profileImageUrl: string | null | undefined;
  videoUrl: string | null | undefined;
  isProfileVideo: boolean | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
};

function CandidateAvatarBase({ 
  profileImageUrl, 
  videoUrl, 
  isProfileVideo, 
  firstName, 
  lastName 
}: CandidateAvatarProps) {
  const [avatarError, setAvatarError] = useState(false);
  
  // Use useMediaUrl hook properly at component level
  const resolvedImageUrl = useMediaUrl(profileImageUrl, 'profile-image');
  const resolvedVideoUrl = useMediaUrl(videoUrl, 'profile-video');
  
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const hasVideo = !!isProfileVideo && !!resolvedVideoUrl;

  if (hasVideo) {
    return (
      <ProfileVideo
        videoUrl={resolvedVideoUrl!}
        coverImageUrl={resolvedImageUrl || undefined}
        userInitials={initials}
        alt="Kandidatvideo"
        className="h-10 w-10 ring-2 ring-white/20 rounded-full"
        showCountdown={false}
        showProgressBar={false}
      />
    );
  }

  return (
    <Avatar className="h-10 w-10 ring-2 ring-white/20 transform-gpu" style={{ contain: 'paint' }}>
      {resolvedImageUrl && !avatarError ? (
        <AvatarImage 
          src={resolvedImageUrl} 
          alt={`${firstName || ''} ${lastName || ''}`}
          onError={() => setAvatarError(true)}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
      ) : (
        <AvatarFallback className="bg-primary/20 text-primary font-semibold">
          {initials || '?'}
        </AvatarFallback>
      )}
    </Avatar>
  );
}

export const CandidateAvatar = React.memo(CandidateAvatarBase, (prev, next) => {
  return (
    prev.profileImageUrl === next.profileImageUrl &&
    prev.videoUrl === next.videoUrl &&
    prev.isProfileVideo === next.isProfileVideo &&
    prev.firstName === next.firstName &&
    prev.lastName === next.lastName
  );
});

export default CandidateAvatar;
