import { memo, useCallback, useEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useInputCapability } from '@/hooks/useInputCapability';
import { useCandidateSummary } from '@/hooks/useCandidateSummary';
import { useCandidateNotes } from '@/hooks/useCandidateNotes';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { CandidateCardFace } from './CandidateCardFace';
import { CandidateNextCardUnderlay } from './CandidateNextCardUnderlay';
import type { ApplicationData } from '@/hooks/useApplicationsData';
import {
  EXIT_HANDOFF_MS,
  EXIT_OPACITY_DURATION,
  EXIT_SPRING,
  EXIT_X,
  PREMIUM_EASE,
  SNAP_SPRING,
  SWIPE_THRESHOLD,
  TOUCH_DRAG_INTENT_THRESHOLD,
  UNDERLAY_INITIAL_OPACITY,
  UNDERLAY_INITIAL_SCALE,
  UNDERLAY_INITIAL_Y,
  UNDERLAY_OPACITY_DURATION,
  UNDERLAY_RISE_SPRING,
  VELOCITY_THRESHOLD,
} from '@/components/swipe/jobSlide/constants';
import { useUndoEntryAnimation } from '@/components/swipe/jobSlide/useUndoEntryAnimation';

interface CandidateSlideProps {
  application: ApplicationData;
  rating: number;
  onOpenFullProfile: () => void;
  onRemoveFromList?: () => void;
  isVisible: boolean;
  isActive: boolean;
  nextApplication?: ApplicationData;
  isUndoEntry?: boolean;
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
  nextApplication,
  isUndoEntry,
  onSkip,
  onRegisterSkip,
  criteria,
}: CandidateSlideProps) {

  const inputCapability = useInputCapability();
  const useTouchTunnel = inputCapability !== 'mouse';
  const x = useMotionValue(0);
  const exitOpacity = useMotionValue(1);
  const entryScale = useMotionValue(1);
  const cardRotate = useTransform(x, [-200, 0, 200], [-6, 0, 6]);
  const cardScale = useTransform(x, [-200, 0, 200], [0.98, 1, 0.98]);
  const combinedScale = useTransform(
    [cardScale, entryScale],
    ([card, entry]) => (card as number) * (entry as number),
  );
  const infoDragOpacity = useTransform(x, [0, 20, 90], [0, 0.65, 1]);
  const skipDragOpacity = useTransform(x, [-90, -20, 0], [1, 0.65, 0]);
  const infoOpacity = useTransform(
    [infoDragOpacity, exitOpacity],
    ([drag, exit]) => (drag as number) * (exit as number) * (exit as number),
  );
  const skipOpacity = useTransform(
    [skipDragOpacity, exitOpacity],
    ([drag, exit]) => (drag as number) * (exit as number) * (exit as number),
  );
  const infoScale = useTransform(x, [0, 90], [0.86, 1]);
  const skipScale = useTransform(x, [-90, 0], [1, 0.86]);
  const underlayY = useMotionValue(UNDERLAY_INITIAL_Y);
  const underlayScale = useMotionValue(UNDERLAY_INITIAL_SCALE);
  const underlayOpacity = useMotionValue(UNDERLAY_INITIAL_OPACITY);
  const suppressOpenRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const thresholdHapticFiredRef = useRef(false);
  const touchRef = useRef<{ startX: number; startY: number; startTime: number; dragging: boolean; cancelled: boolean } | null>(null);

  useUndoEntryAnimation({ isUndoEntry, x, exitOpacity, entryScale });


  const commitSkip = useCallback(() => {
    if (exitTimerRef.current !== null) return;
    suppressOpenRef.current = true;
    hapticMedium();
    animate(x, -EXIT_X, EXIT_SPRING);
    animate(exitOpacity, 0, { duration: EXIT_OPACITY_DURATION, ease: PREMIUM_EASE });
    animate(underlayY, 0, UNDERLAY_RISE_SPRING);
    animate(underlayScale, 1, UNDERLAY_RISE_SPRING);
    animate(underlayOpacity, 1, { duration: UNDERLAY_OPACITY_DURATION, ease: PREMIUM_EASE });
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      onSkip?.();
    }, EXIT_HANDOFF_MS);
  }, [exitOpacity, onSkip, underlayOpacity, underlayScale, underlayY, x]);

  const openFromSwipe = useCallback(() => {
    suppressOpenRef.current = true;
    hapticMedium();
    animate(x, 0, SNAP_SPRING);
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
      if (Math.abs(dx) < TOUCH_DRAG_INTENT_THRESHOLD && Math.abs(dy) < TOUCH_DRAG_INTENT_THRESHOLD) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        gesture.cancelled = true;
        return;
      }
      gesture.dragging = true;
      thresholdHapticFiredRef.current = false;
      suppressOpenRef.current = true;
    }
    if (event.cancelable) event.preventDefault();
    x.set(dx);
    if (!thresholdHapticFiredRef.current && Math.abs(dx) >= SWIPE_THRESHOLD) {
      thresholdHapticFiredRef.current = true;
      hapticLight();
    }
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
    animate(x, 0, SNAP_SPRING);
    window.setTimeout(() => { suppressOpenRef.current = false; }, 120);
  }, [commitSkip, openFromSwipe, x]);

  const handleTouchCancel = useCallback(() => {
    touchRef.current = null;
    animate(x, 0, SNAP_SPRING);
    window.setTimeout(() => { suppressOpenRef.current = false; }, 120);
  }, [x]);

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) {
      commitSkip();
      return;
    }
    if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) {
      openFromSwipe();
      return;
    }
    animate(x, 0, SNAP_SPRING);
  }, [commitSkip, openFromSwipe, x]);

  useEffect(() => {
    if (!onRegisterSkip || !isActive) return;
    onRegisterSkip(commitSkip);
    return () => onRegisterSkip(null);
  }, [commitSkip, isActive, onRegisterSkip]);

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
  }, []);

  // Ett vanligt tryck öppnar profilen. Horisontella drag hanteras separat:
  // vänster hoppar över och höger öppnar kandidatens fullständiga information.
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
        {nextApplication && isActive && (
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
          style={{ x, opacity: exitOpacity, rotate: cardRotate, scale: combinedScale, touchAction: useTouchTunnel ? 'pan-y' : 'auto' }}
          drag={useTouchTunnel ? false : 'x'}
          dragDirectionLock={!useTouchTunnel}
          dragConstraints={useTouchTunnel ? undefined : { left: 0, right: 0 }}
          dragElastic={useTouchTunnel ? undefined : 0.18}
          onDragEnd={useTouchTunnel ? undefined : handleDragEnd}
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

        {isActive && (
          <>
            <motion.div
              className="pointer-events-none absolute inset-0 z-40 flex items-center justify-start will-change-[opacity]"
              style={{ opacity: infoOpacity }}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400/40 via-emerald-400/12 to-transparent" />
              <motion.div style={{ scale: infoScale }} className="relative flex w-[46%] flex-col items-center gap-3 pl-3 will-change-transform">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-500 ring-4 ring-white/30 shadow-[0_10px_28px_rgba(16,185,129,0.45)]">
                  <Info className="h-9 w-9 text-white" strokeWidth={2.75} />
                </div>
                <div className="rounded-full border border-white/25 bg-black/70 px-4 py-1.5">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white">Visa info</span>
                </div>
                <span className="text-center text-xs font-medium text-white">Släpp för kandidatprofil</span>
              </motion.div>
            </motion.div>

            <motion.div
              className="pointer-events-none absolute inset-0 z-40 flex items-center justify-end will-change-[opacity]"
              style={{ opacity: skipOpacity }}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-l from-red-500/40 via-red-500/12 to-transparent" />
              <motion.div style={{ scale: skipScale }} className="relative flex w-[46%] flex-col items-center gap-3 pr-3 will-change-transform">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-red-500 ring-4 ring-white/30 shadow-[0_10px_28px_rgba(239,68,68,0.45)]">
                  <X className="h-9 w-9 text-white" strokeWidth={2.75} />
                </div>
                <div className="rounded-full border border-white/25 bg-black/70 px-4 py-1.5">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white">Hoppa över</span>
                </div>
                <span className="text-center text-xs font-medium text-white">Släpp för nästa kandidat</span>
              </motion.div>
            </motion.div>
          </>
        )}

      </div>
    </div>
  );
});
