import { memo, useEffect } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import type { ApplicationData } from '@/hooks/useApplicationsData';
import { CandidateCardFace } from './CandidateCardFace';

interface CandidateNextCardUnderlayProps {
  application: ApplicationData;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  opacity: MotionValue<number>;
}

export const CandidateNextCardUnderlay = memo(function CandidateNextCardUnderlay({
  application,
  y,
  scale,
  opacity,
}: CandidateNextCardUnderlayProps) {
  const profileImageUrl = useMediaUrl(application.profile_image_url, 'profile-image');
  const coverImageUrl = useMediaUrl(application.cover_image_url, 'profile-image');

  // Underlaget är rent visuellt. Det får ALDRIG montera en video: en andra
  // <video> bakom det aktiva kortet kostar avkodning och ger hack under
  // svepet. Vi visar kandidatens cover-/profilbild — exakt den stillbild som
  // videon ändå startar från, så övergången ser identisk ut.
  const stillImageUrl = coverImageUrl || profileImageUrl || null;

  // Proaktiv avkodning så nästa kort är klart i första framen.
  useEffect(() => {
    if (!stillImageUrl) return;
    const img = new Image();
    img.src = stillImageUrl;
    img.decode?.().catch(() => { /* src hann bytas */ });
  }, [stillImageUrl]);

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
        videoUrl={null}
        hasVideo={false}
        ctaLabel="Tryck för mer info"
        contentBottomClassName="pb-24"
      />
    </motion.div>
  );
});