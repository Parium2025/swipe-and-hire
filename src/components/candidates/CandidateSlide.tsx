import { memo, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useCandidateSummary } from '@/hooks/useCandidateSummary';
import { useCandidateNotes } from '@/hooks/useCandidateNotes';
import { CandidateCardFace } from './CandidateCardFace';
import { CandidateNextCardUnderlay } from './CandidateNextCardUnderlay';
import { useSwipeCardGesture, type SwipeDirection } from '@/components/swipe/jobSlide/useSwipeCardGesture';
import {
  UNDERLAY_INITIAL_OPACITY,
  UNDERLAY_INITIAL_SCALE,
  UNDERLAY_INITIAL_Y,
} from '@/components/swipe/jobSlide/constants';
import type { ApplicationData } from '@/hooks/useApplicationsData';

export interface CandidateSlideSwipeApi {
  swipe: (direction: SwipeDirection) => void;
}

interface CandidateSlideProps {
  application: ApplicationData;
  nextApplication?: ApplicationData;
  rating: number;
  onOpenFullProfile: () => void;
  onRemoveFromList?: () => void;
  isVisible: boolean;
  isActive: boolean;
  overlayOpen?: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onRegisterSwipeApi?: (api: CandidateSlideSwipeApi | null) => void;
  /** Urvalskriterier med AI-resultat för kandidaten. */
  criteria?: { criterion_id: string; title: string; result: 'match' | 'no_match' | 'no_data' }[];
}

export const CandidateSlide = memo(function CandidateSlide({
  application,
  nextApplication,
  isVisible,
  isActive,
  overlayOpen,
  onSwipeLeft,
  onSwipeRight,
  onRegisterSwipeApi,
  criteria,
}: CandidateSlideProps) {

  const x = useMotionValue(0);
  const exitOpacity = useMotionValue(1);
  const cardRotate = useTransform(x, [-200, 0, 200], [-6, 0, 6]);
  const cardScale = useTransform(x, [-200, 0, 200], [0.98, 1, 0.98]);
  const underlayY = useMotionValue(UNDERLAY_INITIAL_Y);
  const underlayScale = useMotionValue(UNDERLAY_INITIAL_SCALE);
  const underlayOpacity = useMotionValue(UNDERLAY_INITIAL_OPACITY);

  useEffect(() => {
    if (!overlayOpen) {
      underlayY.set(UNDERLAY_INITIAL_Y);
      underlayScale.set(UNDERLAY_INITIAL_SCALE);
      underlayOpacity.set(UNDERLAY_INITIAL_OPACITY);
    }
  }, [overlayOpen, underlayOpacity, underlayScale, underlayY]);

  const {
    triggerSwipe,
    handleTouchStartCapture,
    handleTouchMoveCapture,
    handleTouchEndCapture,
    handleTouchCancelCapture,
  } = useSwipeCardGesture({
    useTouchTunnel: true,
    overlayOpen,
    showTapHint: false,
    x,
    exitOpacity,
    underlayY,
    underlayScale,
    underlayOpacity,
    onSwipeLeft,
    onSwipeRight,
    onTapTitle: () => undefined,
    onTapCompany: () => undefined,
    clearTapHint: () => undefined,
  });

  useEffect(() => {
    if (!onRegisterSwipeApi || !isActive) return;
    onRegisterSwipeApi({ swipe: triggerSwipe });
    return () => onRegisterSwipeApi(null);
  }, [isActive, onRegisterSwipeApi, triggerSwipe]);

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
        {nextApplication && isActive && !overlayOpen && (
          <CandidateNextCardUnderlay
            application={nextApplication}
            y={underlayY}
            scale={underlayScale}
            opacity={underlayOpacity}
          />
        )}
        <motion.div
          data-candidate-swipe-card
          className="relative h-full w-full overflow-hidden rounded-2xl bg-card-parium shadow-[0_18px_45px_-10px_rgba(0,0,0,0.4)] will-change-transform select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [&_img]:[-webkit-user-drag:none] [&_video]:[-webkit-user-drag:none]"
          style={{ x, opacity: exitOpacity, rotate: cardRotate, scale: cardScale, touchAction: 'pan-y' }}
          onTouchStartCapture={handleTouchStartCapture}
          onTouchMoveCapture={handleTouchMoveCapture}
          onTouchEndCapture={handleTouchEndCapture}
          onTouchCancelCapture={handleTouchCancelCapture}
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
          />
        </motion.div>

      </div>
    </div>
  );
});
