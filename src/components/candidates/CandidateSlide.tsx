import { memo, useCallback, useEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
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
  const cardRotate = useTransform(x, [-200, 0, 200], [-6, 0, 6]);
  const cardScale = useTransform(x, [-200, 0, 200], [0.98, 1, 0.98]);
  const suppressOpenRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const touchRef = useRef<{ startX: number; startY: number; startTime: number; dragging: boolean; cancelled: boolean } | null>(null);
  const SWIPE_THRESHOLD = 76;
  const VELOCITY_THRESHOLD = 650;


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

  const openFromSwipe = useCallback(() => {
    suppressOpenRef.current = true;
    hapticMedium();
    animate(x, 0, { type: 'spring', stiffness: 360, damping: 32 });
    onOpenFullProfile();
    window.setTimeout(() => { suppressOpenRef.current = false; }, 160);
  }, [onOpenFullProfile, x]);

  const handleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isActive || event.touches.length !== 1) return;
    if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, [role="button"], [data-swipe-action-button]')) return;
    const touch = event.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      dragging: false,
      cancelled: false,
    };
  }, [isActive]);

  const handleTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const gesture = touchRef.current;
    if (!gesture || gesture.cancelled || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;
    if (!gesture.dragging) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        gesture.cancelled = true;
        return;
      }
      gesture.dragging = true;
      suppressOpenRef.current = true;
    }
    if (event.cancelable) event.preventDefault();
    x.set(dx);
  }, [x]);

  const handleTouchEnd = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const gesture = touchRef.current;
    touchRef.current = null;
    if (!gesture || gesture.cancelled || !gesture.dragging) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - gesture.startX;
    const elapsed = Math.max(Date.now() - gesture.startTime, 1);
    const velocityX = (dx / elapsed) * 1000;
    if (dx <= -SWIPE_THRESHOLD || velocityX <= -VELOCITY_THRESHOLD) {
      commitSkip();
      return;
    }
    if (dx >= SWIPE_THRESHOLD || velocityX >= VELOCITY_THRESHOLD) {
      openFromSwipe();
      return;
    }
    animate(x, 0, { type: 'spring', stiffness: 360, damping: 32 });
    window.setTimeout(() => { suppressOpenRef.current = false; }, 120);
  }, [commitSkip, openFromSwipe, x]);

  const handleTouchCancel = useCallback(() => {
    touchRef.current = null;
    animate(x, 0, { type: 'spring', stiffness: 360, damping: 32 });
    window.setTimeout(() => { suppressOpenRef.current = false; }, 120);
  }, [x]);

  useEffect(() => {
    if (!onRegisterSkip || !isActive) return;
    onRegisterSkip(commitSkip);
    return () => onRegisterSkip(null);
  }, [commitSkip, isActive, onRegisterSkip]);

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
  }, []);

  // Kortet får medvetet INTE dras i sidled. Endast vertikal scroll/swipe
  // mellan kandidater är tillåtet; hoppa över sker via knappen.
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
    <div className="flex h-full w-full flex-col px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-[calc(env(safe-area-inset-top,0px)+4.75rem)]">
      <div className="relative min-h-0 flex-1">
        <motion.div
          data-candidate-swipe-card
          className="relative h-full w-full overflow-hidden rounded-2xl bg-card-parium shadow-[0_18px_45px_-10px_rgba(0,0,0,0.4)] will-change-transform select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [&_img]:[-webkit-user-drag:none] [&_video]:[-webkit-user-drag:none]"
          style={{ x, opacity: exitOpacity, rotate: cardRotate, scale: cardScale, touchAction: 'pan-y' }}
          onTouchStartCapture={handleTouchStart}
          onTouchMoveCapture={handleTouchMove}
          onTouchEndCapture={handleTouchEnd}
          onTouchCancelCapture={handleTouchCancel}
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
