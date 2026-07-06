import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { useInputCapability } from '@/hooks/useInputCapability';
import { useCardImage } from '@/hooks/useCardImage';
import type { SwipeJob } from './types';
import { TruncatedText } from '@/components/TruncatedText';
import { Badge } from '@/components/ui/badge';
import { getJobOverlayTextStyle } from '@/lib/jobOverlayText';
import { getImageVersion } from '@/lib/imageTransforms';

import { SWIPE_IMG_TRANSFORM, SWIPE_LOGO_TRANSFORM } from './jobSlide/constants';
import { getImageObjectPosition, getCompanyInitials } from './jobSlide/utils';
import { JobSlideBadgesRow } from './jobSlide/JobSlideBadgesRow';
import { JobSlideActions } from './jobSlide/JobSlideActions';
import { NextCardUnderlay } from './jobSlide/NextCardUnderlay';
import { useUndoEntryAnimation } from './jobSlide/useUndoEntryAnimation';
import { useTapHint } from './jobSlide/useTapHint';
import { useSwipeCardGesture } from './jobSlide/useSwipeCardGesture';

interface JobSlideProps {
  job: SwipeJob;
  nextJob?: SwipeJob;
  applied: boolean;
  saved: boolean;
  skipped?: boolean;
  isVisible: boolean;
  isActive: boolean;
  isLast: boolean;
  sectionHeight?: string;
  overlayOpen?: boolean;
  skipEntryAnimation?: boolean;
  isUndoEntry?: boolean;
  canUndo?: boolean;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSave: () => void;
  onTap: () => void;
  onUndo?: () => void;
}

export const JobSlide = memo(function JobSlide({
  job,
  nextJob,
  applied,
  saved,
  skipped,
  isVisible,
  isActive,
  isLast,
  sectionHeight,
  overlayOpen,
  skipEntryAnimation,
  isUndoEntry,
  canUndo,
  onSwipeRight,
  onSwipeLeft,
  onSave,
  onTap,
  onUndo,
}: JobSlideProps) {
  const inputCapability = useInputCapability();
  const useTouchTunnel = inputCapability !== 'mouse';

  const x = useMotionValue(0);
  const exitOpacity = useMotionValue(1);
  const entryScale = useMotionValue(1);
  const likeOpacity = useTransform(x, [0, 60, 140], [0, 0.4, 1]);
  const nopeOpacity = useTransform(x, [-140, -60, 0], [1, 0.4, 0]);
  const cardRotate = useTransform(x, [-200, 0, 200], [-10, 0, 10]);
  const cardScale = useTransform(x, [-200, 0, 200], [0.95, 1, 0.95]);
  const combinedScale = useTransform(
    [cardScale, entryScale],
    ([cs, es]) => (cs as number) * (es as number),
  );
  const cardShadow = useTransform(x, [-200, 0, 200], [
    '0 25px 60px -12px rgba(0,0,0,0.5), 0 8px 20px -6px rgba(0,0,0,0.3)',
    '0 10px 30px -8px rgba(0,0,0,0.25)',
    '0 25px 60px -12px rgba(0,0,0,0.5), 0 8px 20px -6px rgba(0,0,0,0.3)',
  ]);
  // Underlay: driven av explicit timed animation, INTE drag-progress
  const underlayY = useMotionValue(800);
  const underlayScale = useMotionValue(0.68);
  const underlayOpacity = useMotionValue(0);

  const swipedRef = useRef(false);
  const lastTapTimestampRef = useRef(0);
  const touchGestureRef = useRef<TouchGestureState | null>(null);
  const [showTapHint, setShowTapHint] = useState(false);
  const [tapHintSource, setTapHintSource] = useState<'title' | 'company' | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const displayCompanyName = job.workplace_name || job.company_name || 'Okänt företag';

  // KRITISKT: getImageVersion (image_updated_at ?? updated_at) MÅSTE matcha
  // useSwipeImagePreloader exakt, annars warmar preloadern en URL och kortet
  // renderar en annan → cache-miss + synlig nätverksladdning på första frame.
  const { displayUrl: imageUrl, handleError: handleImageError } = useCardImage(
    job.job_image_url ?? null,
    'job-images',
    getImageVersion(job),
    SWIPE_IMG_TRANSFORM,
  );
  const { displayUrl: nextImageUrl } = useCardImage(
    nextJob?.job_image_url ?? null,
    'job-images',
    getImageVersion(nextJob),
    SWIPE_IMG_TRANSFORM,
  );

  // 🐛 iOS WebKit-bugg: backdrop-filter rastreras EN gång när elementet skapas
  // och uppdateras inte när underliggande <img> laddas in efteråt. Resultat:
  // badgesen "fryser" mot den mörkblå placeholder-bakgrunden och blir blå tills
  // användaren rör skärmen (drag-transform → forced repaint). Lösning: vänta
  // med att applicera blur tills bilden faktiskt är laddad — då samplar
  // glas-effekten rätt innehåll redan från första frame.
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => { setImageLoaded(false); }, [imageUrl]);
  const blurClass = !imageUrl || imageLoaded ? 'backdrop-blur-md' : '';

  // 🚀 Logo i swipe-card är liten (~64px) → be om optimerad version
  const { displayUrl: logoUrl, handleError: handleLogoError } = useCardImage(
    job.company_logo_url ?? null,
    'company-logos',
    getImageVersion(job),
    SWIPE_LOGO_TRANSFORM,
  );
  const { displayUrl: nextLogoUrl } = useCardImage(
    nextJob?.company_logo_url ?? null,
    'company-logos',
    getImageVersion(nextJob),
    SWIPE_LOGO_TRANSFORM,
  );
  const overlayTextStyle = useMemo(
    () => getJobOverlayTextStyle(job.overlay_text_color),
    [job.overlay_text_color],
  );

  const isTitleTruncated = useCallback(() => {
    const el = titleRef.current;
    if (!el) return false;
    return el.scrollHeight > el.clientHeight + 1;
  }, []);

  const tapHintTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const clearTapHint = useCallback(() => {
    setShowTapHint(false);
    setTapHintSource(null);
    if (tapHintTimerRef.current) clearTimeout(tapHintTimerRef.current);
  }, []);

  const armTapHint = useCallback((source: 'title' | 'company') => {
    clearTapHint();
    setShowTapHint(true);
    setTapHintSource(source);
    if (source === 'title' && !isTitleTruncated()) {
      tapHintTimerRef.current = setTimeout(() => setShowTapHint(false), 1800);
    }
  }, [clearTapHint, isTitleTruncated]);

  useEffect(() => {
    if (overlayOpen) clearTapHint();
  }, [overlayOpen, clearTapHint]);

  // 🧹 Städa tap-hint-timern vid unmount så att state
  // inte uppdateras på en avmonterad komponent.
  useEffect(() => {
    return () => {
      if (tapHintTimerRef.current) clearTimeout(tapHintTimerRef.current);
    };
  }, []);

  const triggerSwipe = useCallback((direction: SwipeDirection) => {
    lastTapTimestampRef.current = 0;
    clearTapHint();

    hapticMedium();

    if (direction === 'right') {
      animate(x, 0, SNAP_SPRING);
      onSwipeRight();
      return;
    }

    swipedRef.current = true;

    animate(x, -EXIT_X, {
      type: 'spring',
      stiffness: 220,
      damping: 26,
      mass: 0.85,
    });
    animate(exitOpacity, 0, {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    });

    animate(underlayY, 0, {
      type: 'spring',
      stiffness: 120,
      damping: 22,
      mass: 1.2,
    });
    animate(underlayScale, 1, {
      type: 'spring',
      stiffness: 120,
      damping: 22,
      mass: 1.2,
    });
    animate(underlayOpacity, 1, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    });

    setTimeout(() => {
      onSwipeLeft();
      swipedRef.current = false;
      x.set(0);
      exitOpacity.set(1);
      underlayY.set(800);
      underlayScale.set(0.68);
      underlayOpacity.set(0);
    }, 600);
  }, [clearTapHint, exitOpacity, onSwipeLeft, onSwipeRight, x, underlayY, underlayScale, underlayOpacity]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (swipedRef.current) return;
    const { offset, velocity } = info;
    const dragDistance = Math.abs(offset.x);
    const dragVelocity = Math.abs(velocity.x);

    if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      triggerSwipe('right');
      return;
    }

    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      triggerSwipe('left');
      return;
    }

    if (dragDistance > TAP_MOVE_THRESHOLD || dragVelocity > TAP_RESET_VELOCITY_THRESHOLD) {
      lastTapTimestampRef.current = 0;
      clearTapHint();
    }

    animate(x, 0, SNAP_SPRING);
  }, [clearTapHint, triggerSwipe, x]);

  // Track overlay close timing to prevent tap-through
  const overlayClosedAtRef = useRef(0);
  const prevOverlayOpenRef = useRef(overlayOpen);
  useEffect(() => {
    if (prevOverlayOpenRef.current && !overlayOpen) {
      overlayClosedAtRef.current = Date.now();
    }
    prevOverlayOpenRef.current = overlayOpen;
  }, [overlayOpen]);

  const handleTouchStartCapture = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (
      !useTouchTunnel ||
      swipedRef.current ||
      overlayOpen ||
      event.touches.length !== 1 ||
      isWithinTapHintTarget(event.target) ||
      isWithinInteractiveTarget(event.target)
    ) return;

    // Kill any ongoing scroll momentum so the card "lands" immediately
    const scrollParent = (event.currentTarget as HTMLElement).closest('[class*="overflow-y"]');
    if (scrollParent) {
      scrollParent.scrollTop = scrollParent.scrollTop;
    }

    const touch = event.touches[0];
    touchGestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isDragging: false,
      cancelled: false,
    };
  }, [useTouchTunnel, overlayOpen]);

  const thresholdHapticFiredRef = useRef(false);

  const handleTouchMoveCapture = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (
      !useTouchTunnel ||
      swipedRef.current ||
      event.touches.length !== 1 ||
      isWithinTapHintTarget(event.target) ||
      isWithinInteractiveTarget(event.target)
    ) return;

    const gesture = touchGestureRef.current;
    if (!gesture || gesture.cancelled) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;

    if (!gesture.isDragging) {
      if (Math.abs(deltaX) < TOUCH_DRAG_INTENT_THRESHOLD && Math.abs(deltaY) < TOUCH_DRAG_INTENT_THRESHOLD) {
        return;
      }

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        gesture.cancelled = true;
        lastTapTimestampRef.current = 0;
        clearTapHint();
        return;
      }

      gesture.isDragging = true;
      thresholdHapticFiredRef.current = false;
      lastTapTimestampRef.current = 0;
      clearTapHint();
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    x.set(deltaX);

    if (!thresholdHapticFiredRef.current && Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      thresholdHapticFiredRef.current = true;
      hapticLight();
    }
  }, [clearTapHint, useTouchTunnel, x]);

  const handleTouchEndCapture = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (
      !useTouchTunnel ||
      isWithinTapHintTarget(event.target) ||
      isWithinInteractiveTarget(event.target)
    ) {
      touchGestureRef.current = null;
      return;
    }

    if (overlayOpen || (Date.now() - overlayClosedAtRef.current < 500)) {
      touchGestureRef.current = null;
      return;
    }
    const gesture = touchGestureRef.current;
    touchGestureRef.current = null;

    if (!gesture || swipedRef.current || gesture.cancelled) return;

    const touch = event.changedTouches[0];
    const offsetX = touch.clientX - gesture.startX;
    const offsetY = touch.clientY - gesture.startY;
    const movedDistance = Math.hypot(offsetX, offsetY);
    const pressDuration = Date.now() - gesture.startTime;
    const velocityX = pressDuration > 0 ? (offsetX / pressDuration) * 1000 : 0;

    if (gesture.isDragging) {
      if (offsetX > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD) {
        triggerSwipe('right');
        return;
      }

      if (offsetX < -SWIPE_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
        triggerSwipe('left');
        return;
      }

      animate(x, 0, SNAP_SPRING);
      return;
    }

    if (movedDistance > TAP_MOVE_THRESHOLD || pressDuration > TAP_MAX_DURATION) {
      lastTapTimestampRef.current = 0;
      clearTapHint();
      return;
    }

    const now = Date.now();

    if (showTapHint) {
      clearTapHint();
      lastTapTimestampRef.current = 0;
      return;
    }

    const isTapOnTitle = event.target instanceof Element && Boolean(event.target.closest('[data-title-tap-zone]'));
    const isTapOnCompany = event.target instanceof Element && Boolean(event.target.closest('[data-company-tap-zone]'));

    if (isTapOnTitle) {
      armTapHint('title');
      return;
    }

    if (isTapOnCompany) {
      armTapHint('company');
      return;
    }

    if (now - lastTapTimestampRef.current <= DOUBLE_TAP_DELAY) {
      clearTapHint();
      lastTapTimestampRef.current = 0;
      onTap();
      return;
    }

    lastTapTimestampRef.current = 0;
    onTap();
  }, [armTapHint, clearTapHint, onTap, triggerSwipe, useTouchTunnel, overlayOpen, x, showTapHint]);

  const handleTouchCancelCapture = useCallback(() => {
    clearTapHint();
    touchGestureRef.current = null;
    if (!swipedRef.current) {
      animate(x, 0, SNAP_SPRING);
    }
  }, [clearTapHint, x]);

  // ✨ Ångra: mjuk premium "catch"-animation.
  useUndoEntryAnimation({ isUndoEntry, x, exitOpacity, entryScale });

  return (
    <div
      className="h-full w-full flex flex-col px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-[calc(env(safe-area-inset-top,0px)+4.75rem)]"
      style={sectionHeight ? { height: sectionHeight } : undefined}
    >
      {/* Card area with swipe */}
      <div className="relative min-h-0 flex-1">
        {nextJob && isActive && !overlayOpen && (
          <NextCardUnderlay
            job={nextJob}
            imageUrl={nextImageUrl}
            logoUrl={nextLogoUrl}
            y={underlayY}
            scale={underlayScale}
            opacity={underlayOpacity}
          />
        )}

        <motion.div
          className="relative h-full rounded-2xl overflow-hidden select-none [-webkit-tap-highlight-color:transparent]"
          style={{
            x,
            opacity: exitOpacity,
            rotate: cardRotate,
            scale: combinedScale,
            boxShadow: cardShadow,
            touchAction: useTouchTunnel ? 'pan-y' : 'auto',
          }}
          drag={useTouchTunnel ? false : 'x'}
          dragDirectionLock={!useTouchTunnel}
          dragConstraints={useTouchTunnel ? undefined : { left: 0, right: 0 }}
          dragElastic={useTouchTunnel ? undefined : 0.7}
          onDragEnd={useTouchTunnel ? undefined : handleDragEnd}
          onTouchStartCapture={handleTouchStartCapture}
          onTouchMoveCapture={handleTouchMoveCapture}
          onTouchEndCapture={handleTouchEndCapture}
          onTouchCancelCapture={handleTouchCancelCapture}
          onDoubleClick={useTouchTunnel ? undefined : onTap}
        >
          {/* Bakgrundsbild */}
          <div className="absolute inset-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={job.title}
                className="w-full h-full object-cover"
                style={{ objectPosition: getImageObjectPosition(job.image_focus_position) }}
                loading={isVisible ? 'eager' : 'lazy'}
                draggable={false}
                onLoad={() => setImageLoaded(true)}
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)]" />
            )}
          </div>

          {/* Gradient overlay – stronger for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

          {/* Kategori-badge */}
          {job.occupation && (
            <div className="absolute top-5 left-5 z-10 pointer-events-none">
              <div className={`px-3 py-1.5 rounded-full bg-white/10 ${blurClass} border border-white/15 transform-gpu [will-change:transform]`}>
                <span className="text-white text-xs font-semibold tracking-wide">{job.occupation}</span>
              </div>
            </div>
          )}

          {/* SÖK-stamp */}
          <motion.div
            className="absolute top-8 left-6 z-20 border-4 border-green-400 rounded-lg px-4 py-1 -rotate-12 pointer-events-none"
            style={{ opacity: likeOpacity }}
          >
            <span className="text-green-400 text-2xl font-black tracking-wider">SÖK</span>
          </motion.div>

          {/* TYCKER INTE OM-stamp */}
          <motion.div
            className="absolute top-8 right-6 z-20 border-4 border-red-400 rounded-lg px-3 py-1 rotate-12 pointer-events-none"
            style={{ opacity: nopeOpacity }}
          >
            <span className="text-red-400 text-lg font-black tracking-wider">TYCKER INTE OM</span>
          </motion.div>

          {/* Applied stamp */}
          {applied && (
            <div className="absolute top-4 left-4 z-30 pointer-events-none">
              <div className="-rotate-[12deg] border-[3px] border-green-500 rounded-lg px-4 py-1.5 bg-black/30 backdrop-blur-sm">
                <span className="text-green-500 text-lg font-black tracking-widest uppercase">SÖKT ✓</span>
              </div>
            </div>
          )}

          {/* Skipped stamp */}
          {skipped && !applied && (
            <div className="absolute top-4 left-4 z-30 pointer-events-none">
              <div className="-rotate-[12deg] border-[3px] border-white/40 rounded-lg px-4 py-1.5 bg-black/30 backdrop-blur-sm">
                <span className="text-white/60 text-lg font-black tracking-widest uppercase">SKIPPAD</span>
              </div>
            </div>
          )}

          <div
            className="absolute inset-x-0 top-[20%] bottom-28 z-10 flex items-center justify-center px-6 text-center"
            style={overlayTextStyle}
          >
            <div className="mx-auto w-full max-w-[21rem]">
              {(logoUrl || !imageUrl) && displayCompanyName && (
                <div className="flex justify-center mb-4">
                  {logoUrl ? (
                    <div className={`w-14 h-14 rounded-full bg-white/10 border border-white/15 ${blurClass} transform-gpu [will-change:transform] flex items-center justify-center overflow-hidden shadow-lg`}>
                      <img
                        src={logoUrl}
                        alt={displayCompanyName}
                        className="w-full h-full object-cover"
                        draggable={false}
                        onError={handleLogoError}
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-white/40 tracking-wide select-none">
                        {getCompanyInitials(displayCompanyName)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-center" data-company-tap-zone>
                <Badge variant="glass" className="inline-flex max-w-[80%] min-w-0 items-center gap-1.5 border-white/15 px-3 py-1 text-white">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <TruncatedText
                    text={displayCompanyName}
                    className="min-w-0 flex-1 text-sm font-medium"
                    tooltipSide="bottom"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                    }}
                  />
                </Badge>
              </div>

              <h2
                ref={titleRef}
                data-title-tap-zone
                className="mt-1 text-[clamp(1.58rem,6.4vw,2.1rem)] font-extrabold text-white leading-[1.08] tracking-tight line-clamp-2"
                style={overlayTextStyle}
              >
                {job.title}
              </h2>
              <p className="text-white font-semibold text-base mt-2 truncate" style={overlayTextStyle}>
                {[job.employment_type && getEmploymentTypeLabel(job.employment_type), job.location].filter(Boolean).join(' • ')}
              </p>

              <JobSlideBadgesRow job={job} blurClass={blurClass} />
            </div>
          </div>

          {showTapHint && tapHintSource === 'title' && isTitleTruncated() && (
            <div className="absolute inset-x-4 bottom-24 z-30 pointer-events-none">
              <div
                data-tap-hint-scroll
                className="pointer-events-auto rounded-xl border border-white/20 bg-slate-900/95 px-4 py-3 backdrop-blur-md shadow-2xl max-h-[300px] overflow-y-auto overscroll-contain touch-pan-y"
              >
                <p className="text-sm font-semibold text-white leading-relaxed break-words whitespace-pre-wrap">{job.title}</p>
              </div>
            </div>
          )}

          <JobSlideActions
            saved={saved}
            canUndo={canUndo}
            onUndo={onUndo}
            onSave={onSave}
            onDislike={() => triggerSwipe('left')}
            onLike={() => triggerSwipe('right')}
          />
        </motion.div>
      </div>
    </div>
  );
});
