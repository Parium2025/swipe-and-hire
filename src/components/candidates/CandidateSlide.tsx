import { memo, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useInputCapability } from '@/hooks/useInputCapability';
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
import { useUndoEntryAnimation } from '@/components/swipe/jobSlide/useUndoEntryAnimation';
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
  isUndoEntry?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Bakåtkompatibel alias för vänstersvep. */
  onSkip?: () => void;
  onRegisterSwipeApi?: (api: CandidateSlideSwipeApi | null) => void;
  /** Urvalskriterier med AI-resultat för kandidaten. */
  criteria?: { criterion_id: string; title: string; result: 'match' | 'no_match' | 'no_data' }[];
}

export const CandidateSlide = memo(function CandidateSlide({
  application,
  nextApplication,
  onOpenFullProfile,
  isVisible,
  isActive,
  overlayOpen,
  isUndoEntry,
  onSwipeLeft,
  onSwipeRight,
  onSkip,
  onRegisterSwipeApi,
  criteria,
}: CandidateSlideProps) {
  const inputCapability = useInputCapability();
  const useTouchTunnel = inputCapability !== 'mouse';
  const x = useMotionValue(0);
  const exitOpacity = useMotionValue(1);
  const entryScale = useMotionValue(1);
  const infoDragOpacity = useTransform(x, [0, 20, 90], [0, 0.65, 1]);
  const rejectDragOpacity = useTransform(x, [-90, -20, 0], [1, 0.65, 0]);
  const infoOpacity = useTransform(
    [infoDragOpacity, exitOpacity],
    ([opacity, exit]) => (opacity as number) * (exit as number) * (exit as number),
  );
  const rejectOpacity = useTransform(
    [rejectDragOpacity, exitOpacity],
    ([opacity, exit]) => (opacity as number) * (exit as number) * (exit as number),
  );
  const infoScale = useTransform(x, [0, 90], [0.86, 1]);
  const rejectScale = useTransform(x, [-90, 0], [1, 0.86]);
  const cardRotate = useTransform(x, [-200, 0, 200], [-6, 0, 6]);
  const cardScale = useTransform(x, [-200, 0, 200], [0.98, 1, 0.98]);
  const combinedScale = useTransform(
    [cardScale, entryScale],
    ([dragScale, undoScale]) => (dragScale as number) * (undoScale as number),
  );
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
    handleDragEnd,
    handleTouchStartCapture,
    handleTouchMoveCapture,
    handleTouchEndCapture,
    handleTouchCancelCapture,
  } = useSwipeCardGesture({
    useTouchTunnel,
    overlayOpen,
    showTapHint: false,
    x,
    exitOpacity,
    underlayY,
    underlayScale,
    underlayOpacity,
    onSwipeLeft: onSwipeLeft ?? onSkip ?? (() => undefined),
    onSwipeRight: onSwipeRight ?? onOpenFullProfile,
    onTapTitle: () => undefined,
    onTapCompany: () => undefined,
    clearTapHint: () => undefined,
  });

  useUndoEntryAnimation({ isUndoEntry, x, exitOpacity, entryScale });

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
          style={{
            x,
            opacity: exitOpacity,
            rotate: cardRotate,
            scale: combinedScale,
            touchAction: useTouchTunnel ? 'pan-y' : 'auto',
          }}
          drag={useTouchTunnel ? false : 'x'}
          dragDirectionLock={!useTouchTunnel}
          dragConstraints={useTouchTunnel ? undefined : { left: 0, right: 0 }}
          dragElastic={useTouchTunnel ? undefined : 0.18}
          onDragEnd={useTouchTunnel ? undefined : handleDragEnd}
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

        {isActive && !overlayOpen && (
          <>
            <motion.div
              className="absolute inset-0 z-40 pointer-events-none flex items-center justify-start will-change-[opacity]"
              style={{ opacity: infoOpacity }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/40 via-emerald-400/12 to-transparent rounded-2xl" />
              <motion.div
                style={{ scale: infoScale }}
                className="relative flex flex-col items-center gap-3 pl-3 w-[46%] will-change-transform"
              >
                <div className="grid place-items-center h-20 w-20 rounded-full bg-emerald-500 ring-4 ring-white/30 shadow-[0_10px_28px_rgba(16,185,129,0.45)]">
                  <Info className="h-9 w-9 text-white" strokeWidth={2.75} />
                </div>
                <div className="rounded-full border border-white/25 bg-black/70 px-4 py-1.5">
                  <span className="text-white text-[13px] font-semibold tracking-[0.1em] uppercase">
                    Visa profil
                  </span>
                </div>
                <span className="text-white text-xs font-medium text-center">Släpp för kandidatinfo</span>
              </motion.div>
            </motion.div>

            <motion.div
              className="absolute inset-0 z-40 pointer-events-none flex items-center justify-end will-change-[opacity]"
              style={{ opacity: rejectOpacity }}
            >
              <div className="absolute inset-0 bg-gradient-to-l from-red-500/40 via-red-500/12 to-transparent rounded-2xl" />
              <motion.div
                style={{ scale: rejectScale }}
                className="relative flex flex-col items-center gap-3 pr-3 w-[46%] will-change-transform"
              >
                <div className="grid place-items-center h-20 w-20 rounded-full bg-red-500 ring-4 ring-white/30 shadow-[0_10px_28px_rgba(239,68,68,0.45)]">
                  <X className="h-9 w-9 text-white" strokeWidth={2.75} />
                </div>
                <div className="rounded-full border border-white/25 bg-black/70 px-4 py-1.5">
                  <span className="text-white text-[13px] font-semibold tracking-[0.1em] uppercase">
                    Neka
                  </span>
                </div>
                <span className="text-white text-xs font-medium text-center">Släpp för nästa kandidat</span>
              </motion.div>
            </motion.div>
          </>
        )}

      </div>
    </div>
  );
});
