import { memo } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { CandidateCardFace } from './CandidateCardFace';
import type { ApplicationData } from '@/hooks/useApplicationsData';

interface CandidateNextCardUnderlayProps {
  application: ApplicationData;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  opacity: MotionValue<number>;
}

/** Visuellt förberett nästa kandidatkort under det aktiva kortet. */
export const CandidateNextCardUnderlay = memo(function CandidateNextCardUnderlay({
  application,
  y,
  scale,
  opacity,
}: CandidateNextCardUnderlayProps) {
  const profileImageUrl = useMediaUrl(application.profile_image_url, 'profile-image');
  const videoUrl = useMediaUrl(application.video_url, 'profile-video');
  const coverImageUrl = useMediaUrl(application.cover_image_url, 'profile-image');

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-card-parium shadow-2xl"
      style={{ y, scale, opacity }}
    >
      <CandidateCardFace
        fullBleed
        firstName={application.first_name}
        lastName={application.last_name}
        age={application.age}
        residence={application.location}
        profileImageUrl={profileImageUrl}
        coverImageUrl={coverImageUrl}
        videoUrl={videoUrl}
        hasVideo={Boolean(application.is_profile_video)}
        contentBottomClassName="pb-24"
      />
    </motion.div>
  );
});