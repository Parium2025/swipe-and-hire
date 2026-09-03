import React from 'react';
import { User, Video as VideoIcon } from 'lucide-react';
import { useMediaUrl } from '@/hooks/useMediaUrl';

/** Rund miniatyr för en profil – bild, videoikon eller personikon. */
export function ProfileAvatar({
  imagePath, imageMediaType = 'profile-image', signedImageUrl, hasVideo, size = 56, eager = false,
}: {
  imagePath?: string | null;
  imageMediaType?: 'profile-image' | 'cover-image';
  signedImageUrl?: string | null;
  hasVideo?: boolean;
  size?: number;
  /** Sätt när miniatyren ska målas direkt (t.ex. i en dropdown som redan är förvärmd). */
  eager?: boolean;
}) {
  const resolved = useMediaUrl(imagePath || undefined, imageMediaType);
  const src = signedImageUrl ?? resolved;

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10"
      style={{ height: size, width: size }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : hasVideo ? (
        <VideoIcon className="h-5 w-5" />
      ) : (
        <User className="h-5 w-5" />
      )}
    </span>
  );
}

export default ProfileAvatar;
