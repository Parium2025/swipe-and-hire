import { memo, useCallback, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useCandidateSummary } from '@/hooks/useCandidateSummary';
import { useCandidateNotes } from '@/hooks/useCandidateNotes';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { CandidateCardFace } from './CandidateCardFace';
import { CandidateSlideActions } from './CandidateSlideActions';
import type { ApplicationData } from '@/hooks/useApplicationsData';

interface CandidateSlideProps {
  application: ApplicationData;
  rating: number;
  onOpenFullProfile: () => void;
  onRemoveFromList?: () => void;
  isLast: boolean;
  isVisible: boolean;
  /** Åtgärdsraden visas bara när svepvyn kan hantera åtgärderna. */
  showActions?: boolean;
  saved?: boolean;
  onSave?: () => void;
  onSkip?: () => void;
  /** Urvalskriterier med AI-resultat för kandidaten. */
  criteria?: { criterion_id: string; title: string; result: 'match' | 'no_match' | 'no_data' }[];
}

export const CandidateSlide = memo(function CandidateSlide({
  application,
  onOpenFullProfile,
  isLast,
  isVisible,
  showActions = false,
  saved = false,
  onSave,
  onSkip,
  criteria,
}: CandidateSlideProps) {

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-6, 0, 6]);
  const scale = useTransform(x, [-220, 0, 220], [0.985, 1, 0.985]);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    horizontal: boolean;
    cancelled: boolean;
  } | null>(null);
  const suppressOpenRef = useRef(false);
  const thresholdHapticRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);

  const resetCard = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 340, damping: 28, mass: 0.9 });
  }, [x]);

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
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      onSkip?.();
      x.set(0);
      window.setTimeout(() => { suppressOpenRef.current = false; }, 120);
    }, 240);
  }, [onSkip, x]);

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
  }, []);

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element && Boolean(
      target.closest('button, a, input, [role="button"], [data-swipe-action-button], [data-candidate-video-control]'),
    );

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!onSkip || event.touches.length !== 1 || isInteractiveTarget(event.target)) return;
    const touch = event.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      horizontal: false,
      cancelled: false,
    };
    thresholdHapticRef.current = false;
  }, [onSkip]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const gesture = touchRef.current;
    if (!gesture || gesture.cancelled || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;

    if (!gesture.horizontal) {
      if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) return;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        gesture.cancelled = true;
        return;
      }
      gesture.horizontal = true;
      suppressOpenRef.current = true;
    }

    if (event.cancelable) event.preventDefault();
    // Högerdrag har motstånd eftersom endast vänsterdrag går vidare.
    x.set(deltaX > 0 ? deltaX * 0.28 : deltaX);
    if (!thresholdHapticRef.current && deltaX <= -90) {
      thresholdHapticRef.current = true;
      hapticLight();
    }
  }, [x]);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const gesture = touchRef.current;
    touchRef.current = null;
    if (!gesture || gesture.cancelled || !gesture.horizontal) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - gesture.startX;
    if (deltaX <= -90) {
      commitSkip();
      return;
    }
    resetCard();
    window.setTimeout(() => { suppressOpenRef.current = false; }, 120);
  }, [commitSkip, resetCard]);

  const handleTouchCancel = useCallback(() => {
    touchRef.current = null;
    resetCard();
    window.setTimeout(() => { suppressOpenRef.current = false; }, 120);
  }, [resetCard]);

  const handleOpen = useCallback(() => {
    if (!suppressOpenRef.current) onOpenFullProfile();
  }, [onOpenFullProfile]);

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
    <div className="flex h-full w-full flex-col items-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+3.25rem)]">
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3">
        <motion.div
          className="relative flex min-h-0 w-full flex-1 flex-col items-center overflow-hidden rounded-2xl bg-card-parium shadow-[0_18px_45px_-10px_rgba(0,0,0,0.4)] will-change-transform [-webkit-tap-highlight-color:transparent]"
          style={{ x, rotate, scale, touchAction: 'pan-y' }}
          onTouchStartCapture={handleTouchStart}
          onTouchMoveCapture={handleTouchMove}
          onTouchEndCapture={handleTouchEnd}
          onTouchCancelCapture={handleTouchCancel}
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
            contentBottomClassName={showActions ? 'pb-24' : 'pb-6'}
            criteria={criteria}
            onOpen={handleOpen}

          />

          {showActions && (
            <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center">
              <CandidateSlideActions
                saved={saved}
                onSave={() => onSave?.()}
                onSkip={commitSkip}
                onOpenInfo={onOpenFullProfile}
              />
            </div>
          )}
        </motion.div>

        {!isLast && (
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <ChevronDown className="h-4 w-4 animate-bounce fill-white text-white" />
            <span className="text-[10px] font-medium text-white">Nästa kandidat</span>
          </div>
        )}
      </div>
    </div>
  );
});
