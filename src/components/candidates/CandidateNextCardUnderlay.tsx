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
  const coverImageUrl = useMediaUrl(application.cover_image_url, 'profile-image');
  const displayImageUrl = application.is_profile_video
    ? (coverImageUrl || profileImageUrl)
    : (profileImageUrl || coverImageUrl);

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
        profileImageUrl={displayImageUrl}
        coverImageUrl={displayImageUrl}
        hasVideo={false}
        contentBottomClassName="pb-24"
      />
    </motion.div>
  );
});