import { memo, useCallback, useEffect, useLayoutEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useInputCapability } from '@/hooks/useInputCapability';
import { CandidateCardFace } from './CandidateCardFace';
import { CandidateNextCardUnderlay } from './CandidateNextCardUnderlay';
import type { ApplicationData } from '@/hooks/useApplicationsData';
import {
  TOUCH_DRAG_INTENT_THRESHOLD,
  UNDERLAY_INITIAL_OPACITY,
  UNDERLAY_INITIAL_SCALE,
  UNDERLAY_INITIAL_Y,
} from '@/components/swipe/jobSlide/constants';
import { useUndoEntryAnimation } from '@/components/swipe/jobSlide/useUndoEntryAnimation';
import { useSwipeCardGesture } from '@/components/swipe/jobSlide/useSwipeCardGesture';

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
  const suppressTimerRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const suppressOpenFor = useCallback((ms: number) => {
    suppressOpenRef.current = true;
    if (suppressTimerRef.current !== null) window.clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = window.setTimeout(() => {
      suppressTimerRef.current = null;
      suppressOpenRef.current = false;
    }, ms);
  }, []);

  const handleSwipeLeft = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  const handleSwipeRight = useCallback(() => {
    suppressOpenFor(240);
    onOpenFullProfile();
  }, [onOpenFullProfile, suppressOpenFor]);

  const noop = useCallback(() => {}, []);

  // EXAKT samma gestmotor som jobbsökarens swipe-läge. Tidigare fanns en
  // egen kopia här, med risk för att de två glider isär.
  const {
    triggerSwipe,
    resetGesture,
    handleDragEnd,
    handleTouchStartCapture,
    handleTouchMoveCapture,
    handleTouchEndCapture,
    handleTouchCancelCapture,
  } = useSwipeCardGesture({
    useTouchTunnel,
    // Inaktiva kort ska inte ta emot gester. Hooken låser dessutom input en
    // kort stund när kortet blir aktivt igen, vilket tar bort tap-through.
    overlayOpen: !isActive,
    showTapHint: false,
    x,
    exitOpacity,
    underlayY,
    underlayScale,
    underlayOpacity,
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    onTapTitle: noop,
    onTapCompany: noop,
    clearTapHint: noop,
  });

  useUndoEntryAnimation({ isUndoEntry, x, exitOpacity, entryScale });

  // Virtualiseringen behåller kortinstansen när användaren ångrar. Ett kort
  // som nyss nekats har då fortfarande sin commit-spärr och sina exitvärden.
  // Återställ allt synkront före paint när kortet blir aktivt igen, så Ångra
  // ger ett fullt interaktivt kort utan en låst eller halvtransparent frame.
  useLayoutEffect(() => {
    if (!isUndoEntry) return;
    resetGesture();
    suppressOpenRef.current = false;
    dragStartRef.current = null;
    underlayY.set(UNDERLAY_INITIAL_Y);
    underlayScale.set(UNDERLAY_INITIAL_SCALE);
    underlayOpacity.set(UNDERLAY_INITIAL_OPACITY);
  }, [isUndoEntry, resetGesture, underlayOpacity, underlayScale, underlayY]);

  // Klick-suppression: ett horisontellt drag får aldrig sluta med att
  // kandidatprofilen öppnas av det efterföljande click-eventet.
  const onTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    dragStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    handleTouchStartCapture(event);
  }, [handleTouchStartCapture]);

  const onTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    const touch = event.touches[0];
    if (start && touch && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > TOUCH_DRAG_INTENT_THRESHOLD) {
      suppressOpenRef.current = true;
    }
    handleTouchMoveCapture(event);
  }, [handleTouchMoveCapture]);

  const onTouchEnd = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    handleTouchEndCapture(event);
    dragStartRef.current = null;
    if (suppressOpenRef.current) suppressOpenFor(200);
  }, [handleTouchEndCapture, suppressOpenFor]);

  const onTouchCancel = useCallback(() => {
    handleTouchCancelCapture();
    dragStartRef.current = null;
    suppressOpenFor(120);
  }, [handleTouchCancelCapture, suppressOpenFor]);

  const commitSkip = useCallback(() => {
    triggerSwipe('left');
  }, [triggerSwipe]);

  // Kortinstanserna återanvänds (virtualisering). Ett kort som blir aktivt
  // igen — via Ångra eller genom att användaren skrollar tillbaka — måste
  // alltid vara fullt interaktivt, aldrig låst av en tidigare commit.
  useLayoutEffect(() => {
    dragStartRef.current = null;
    if (isActive) {
      resetGesture();
      suppressOpenRef.current = false;
    }
  }, [isActive, resetGesture]);

  useEffect(() => {
    if (!onRegisterSkip || !isActive) return;
    onRegisterSkip(commitSkip);
    return () => onRegisterSkip(null);
  }, [commitSkip, isActive, onRegisterSkip]);

  useEffect(() => () => {
    if (suppressTimerRef.current !== null) window.clearTimeout(suppressTimerRef.current);
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
          className="relative h-full w-full overflow-hidden rounded-2xl bg-card-parium shadow-[0_18px_45px_-10px_rgba(0,0,0,0.4)] will-change-transform select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [backface-visibility:hidden] [&_img]:[-webkit-user-drag:none] [&_video]:[-webkit-user-drag:none]"
          style={{ x, opacity: exitOpacity, rotate: cardRotate, scale: combinedScale, touchAction: useTouchTunnel ? 'pan-y' : 'auto' }}
          drag={useTouchTunnel ? false : 'x'}
          dragDirectionLock={!useTouchTunnel}
          dragConstraints={useTouchTunnel ? undefined : { left: 0, right: 0 }}
          dragElastic={useTouchTunnel ? undefined : 0.18}
          onDragEnd={useTouchTunnel ? undefined : handleDragEnd}
          onTouchStartCapture={onTouchStart}
          onTouchMoveCapture={onTouchMove}
          onTouchEndCapture={onTouchEnd}
          onTouchCancelCapture={onTouchCancel}
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
