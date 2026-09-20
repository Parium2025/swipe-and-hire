import { memo, useCallback, useEffect, useRef } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useCandidateSummary } from '@/hooks/useCandidateSummary';
import { useCandidateNotes } from '@/hooks/useCandidateNotes';
import { hapticMedium } from '@/lib/haptics';
import { CandidateCardFace } from './CandidateCardFace';
import type { ApplicationData } from '@/hooks/useApplicationsData';

interface CandidateSlideProps {
  application: ApplicationData;
  rating: number;
  onOpenFullProfile: () => void;
  onRemoveFromList?: () => void;
  isVisible: boolean;
  isActive: boolean;
  onSkip?: () => void;
  onRegisterSkip?: (skip: (() => void) | null) => void;
  /** Urvalskriterier med AI-resultat för kandidaten. */
  criteria?: { criterion_id: string; title: string; result: 'match' | 'no_match' | 'no_data' }[];
}

export const CandidateSlide = memo(function CandidateSlide({
  application,
  onOpenFullProfile,
  isVisible,
  isActive,
  onSkip,
  onRegisterSkip,
  criteria,
}: CandidateSlideProps) {

  const x = useMotionValue(0);
  const exitOpacity = useMotionValue(1);
  const suppressOpenRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);


  const commitSkip = useCallback(() => {
    if (exitTimerRef.current !== null) return;
    suppressOpenRef.current = true;
    hapticMedium();
    animate(x, -Math.max(window.innerWidth * 1.25, 520), {
      type: 'spring',
      stiffness: 220,
      damping: 26,
      mass: 0.85,
    });
    animate(exitOpacity, 0, { duration: 0.38, ease: [0.22, 1, 0.36, 1] });
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      onSkip?.();
      x.set(0);
      exitOpacity.set(1);
      window.setTimeout(() => { suppressOpenRef.current = false; }, 120);
    }, 240);
  }, [exitOpacity, onSkip, x]);

  useEffect(() => {
    if (!onRegisterSkip || !isActive) return;
    onRegisterSkip(commitSkip);
    return () => onRegisterSkip(null);
  }, [commitSkip, isActive, onRegisterSkip]);

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
  }, []);

  const handleOpen = useCallback(() => {
    if (!suppressOpenRef.current) onOpenFullProfile();
  }, [onOpenFullProfile]);

  // Svep vänster = hoppa över, svep höger = visa all info. Vertikal scroll
  // mellan kandidater påverkas inte (riktningslås + pan-y).
  const handleDragEnd = useCallback((
    _event: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) => {
    const { offset, velocity } = info;
    const goLeft = offset.x < -110 || velocity.x < -650;
    const goRight = offset.x > 110 || velocity.x > 650;

    if (goLeft) {
      commitSkip();
      return;
    }

    if (goRight) {
      suppressOpenRef.current = true;
      hapticMedium();
      animate(x, 0, { type: 'spring', stiffness: 320, damping: 30 });
      onOpenFullProfile();
      window.setTimeout(() => { suppressOpenRef.current = false; }, 250);
      return;
    }

    animate(x, 0, { type: 'spring', stiffness: 320, damping: 30 });
  }, [commitSkip, onOpenFullProfile, x]);

  const profileImageUrl = useMediaUrl(application.profile_image_url, 'profile-image');
  const videoUrl = useMediaUrl(application.video_url, 'profile-video');
  const coverImageUrl = useMediaUrl(application.cover_image_url, 'profile-image');
  const isProfileVideo = application.is_profile_video;

  // Behåll samma förvärmning som tidigare medan kandidaten är i eller nära
  // viewporten. Den vanliga kandidatprofilen kan då öppnas med färdig data.
  useCandidateSummary({
    applicantId: application.applicant_id,
    jobId: application.job_id,
    applicationId: application.id,
    cvUrl: application.cv_url,
    open: isVisible,
  });

  const { fetchNotes } = useCandidateNotes({
    applicantId: application.applicant_id,
    jobId: application.job_id,
    enabled: isVisible,
  });

  useEffect(() => {
    if (isVisible) fetchNotes();
  }, [isVisible, fetchNotes]);

  return (
    <div className="flex h-full w-full flex-col px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-[calc(env(safe-area-inset-top,0px)+4.75rem)]">
      <div className="relative min-h-0 flex-1">
        <motion.div
          data-candidate-swipe-card
          className="relative h-full w-full overflow-hidden rounded-2xl bg-card-parium shadow-[0_18px_45px_-10px_rgba(0,0,0,0.4)] will-change-transform select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [&_img]:[-webkit-user-drag:none] [&_video]:[-webkit-user-drag:none]"
          style={{ x, rotate, opacity: exitOpacity, touchAction: 'pan-y' }}
          drag="x"
          dragDirectionLock
          dragMomentum={false}
          dragElastic={0.85}
          dragConstraints={{ left: 0, right: 0 }}
          onDragStart={() => { suppressOpenRef.current = true; }}
          onDragEnd={handleDragEnd}
          onContextMenuCapture={(event) => event.preventDefault()}
          onDragStartCapture={(event) => event.preventDefault()}
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
            hasVideo={Boolean(isProfileVideo)}
            ctaLabel="Tryck för mer info"
            contentBottomClassName="pb-24"
            criteria={criteria}
            onOpen={handleOpen}

          />
        </motion.div>

      </div>
    </div>
  );
});
