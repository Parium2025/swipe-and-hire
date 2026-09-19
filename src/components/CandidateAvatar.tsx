import React, { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ProfileVideo from "@/components/ProfileVideo";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import { AVATAR_TRANSFORM, MEDIA_URL_TTL } from '@/lib/mediaPresets';

type CandidateAvatarProps = {
  profileImageUrl: string | null | undefined;
  coverImageUrl?: string | null | undefined;
  videoUrl: string | null | undefined;
  isProfileVideo: boolean | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  onPlayingChange?: (isPlaying: boolean) => void;
  stopPropagation?: boolean;
};

function CandidateAvatarBase({ 
  profileImageUrl, 
  coverImageUrl,
  videoUrl, 
  isProfileVideo, 
  firstName, 
  lastName,
  onPlayingChange,
  stopPropagation = false
}: CandidateAvatarProps) {
  const [avatarError, setAvatarError] = useState(false);
  
  // Use useMediaUrl hook properly at component level
  // These will generate signed URLs for private bucket files
  // Avatarn renderas alltid 40x40 → be Supabase om en 40px-version (2x för retina) → ~95% mindre fil
  const resolvedImageUrl = useMediaUrl(profileImageUrl, 'profile-image', MEDIA_URL_TTL, AVATAR_TRANSFORM);
  const resolvedCoverUrl = useMediaUrl(coverImageUrl, 'profile-image', MEDIA_URL_TTL, AVATAR_TRANSFORM);
  const resolvedVideoUrl = useMediaUrl(videoUrl, 'profile-video');
  
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const hasVideo = !!isProfileVideo && !!resolvedVideoUrl;
  // För videoprofiler är covern den bild kandidaten själv har anpassat för
  // visning. Profilbilden är endast fallback om cover saknas.
  const videoCoverUrl = resolvedCoverUrl || resolvedImageUrl || undefined;
  const staticImageUrl = isProfileVideo
    ? (resolvedCoverUrl || resolvedImageUrl)
    : (resolvedImageUrl || resolvedCoverUrl);
  const hasImage = !!staticImageUrl && !avatarError;

  // Reset error state when URL changes
  useEffect(() => {
    if (staticImageUrl) {
      setAvatarError(false);
    }
  }, [staticImageUrl]);

  // Debug logging for troubleshooting (remove in production)
  useEffect(() => {
    if (profileImageUrl && !resolvedImageUrl) {
      console.debug('[CandidateAvatar] Waiting for signed URL:', profileImageUrl);
    }
  }, [profileImageUrl, resolvedImageUrl]);

  const handleClick = stopPropagation ? (e: React.MouseEvent) => e.stopPropagation() : undefined;

  // Media är på väg (path finns men signerad URL/video är inte klar än).
  // Samma cirkulära Avatar-skal används i alla tillstånd så Safari aldrig
  // komponerar om porträttet som en fyrkant under filterbyten.
  const hasExpectedMedia = !!profileImageUrl || !!coverImageUrl || (!!isProfileVideo && !!videoUrl);
  const mediaPending = hasExpectedMedia && !staticImageUrl && !resolvedVideoUrl && !avatarError;

  // Skyddsnät: om signeringen misslyckas (t.ex. rättighetsfel eller nätfel)
  // får kortet ALDRIG fastna i en tom platta för alltid — efter en kort stund
  // visar vi initialerna i stället.
  const [pendingTimedOut, setPendingTimedOut] = useState(false);
  useEffect(() => {
    if (!mediaPending) {
      setPendingTimedOut(false);
      return;
    }
    setPendingTimedOut(false);
    const timer = setTimeout(() => setPendingTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, [mediaPending, profileImageUrl, videoUrl]);

  if (hasVideo) {
    return (
      <div onClick={handleClick}>
        <ProfileVideo
          videoUrl={resolvedVideoUrl}
          coverImageUrl={videoCoverUrl}
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

  if (mediaPending && !pendingTimedOut) {
    return (
      <Avatar
        className="h-10 w-10 bg-white/10 ring-2 ring-inset ring-white/20 transform-gpu"
        aria-label={`${firstName || ''} ${lastName || ''}`.trim() || undefined}
      >
        <span className="h-full w-full rounded-full bg-white/10" aria-hidden="true" />
      </Avatar>
    );
  }


  return (
    <Avatar className="h-10 w-10 ring-2 ring-inset ring-white/20 transform-gpu">
      <AvatarImage
        src={staticImageUrl || ''}
        alt={`${firstName || ''} ${lastName || ''}`}
        loading="eager"
        decoding="async"
        onError={() => setAvatarError(true)}
      />
      <AvatarFallback className="bg-white/20 text-white font-semibold" delayMs={hasImage ? 1200 : 0}>
        {initials || '?'}
      </AvatarFallback>
    </Avatar>
  );
}

export const CandidateAvatar = React.memo(CandidateAvatarBase, (prev, next) => {
  return (
    prev.profileImageUrl === next.profileImageUrl &&
    prev.coverImageUrl === next.coverImageUrl &&
    prev.videoUrl === next.videoUrl &&
    prev.isProfileVideo === next.isProfileVideo &&
    prev.firstName === next.firstName &&
    prev.lastName === next.lastName &&
    prev.onPlayingChange === next.onPlayingChange &&
    prev.stopPropagation === next.stopPropagation
  );
});

export default CandidateAvatar;
