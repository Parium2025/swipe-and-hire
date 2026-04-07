import { memo, useCallback, useEffect, useRef, useState, useMemo, type TouchEvent as ReactTouchEvent } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { CheckCircle, X, Bookmark, Heart } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { useInputCapability } from '@/hooks/useInputCapability';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import type { SwipeJob } from './SwipeCard';

function resolveImageUrl(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const { data } = supabase.storage.from('job-images').getPublicUrl(url);
  return data?.publicUrl || null;
}

interface JobSlideProps {
  job: SwipeJob;
  applied: boolean;
  saved: boolean;
  isVisible: boolean;
  isLast: boolean;
  sectionHeight?: string;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSave: () => void;
  onTap: () => void;
}

interface TouchGestureState {
  startX: number;
  startY: number;
  startTime: number;
  isDragging: boolean;
  cancelled: boolean;
}

type SwipeDirection = 'left' | 'right';

const SWIPE_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 400;
const EXIT_X = typeof window !== 'undefined' ? window.innerWidth * 1.2 : 500;
const DOUBLE_TAP_DELAY = 280;
const TAP_MAX_DURATION = 250;
const TAP_MOVE_THRESHOLD = 18;
const TAP_RESET_VELOCITY_THRESHOLD = 120;
const TOUCH_DRAG_INTENT_THRESHOLD = 12;
const TAP_HINT_DURATION = 1800;

function getImageObjectPosition(value?: string): string {
  if (!value || value === 'center') return 'center 50%';
  if (value === 'top') return 'center 20%';
  if (value === 'bottom') return 'center 80%';
  return `center ${value}%`;
}

export const JobSlide = memo(function JobSlide({
  job,
  applied,
  saved,
  isVisible,
  isLast,
  sectionHeight,
  onSwipeRight,
  onSwipeLeft,
  onSave,
  onTap,
}: JobSlideProps) {
  const inputCapability = useInputCapability();
  const useTouchTunnel = inputCapability !== 'mouse';
  const x = useMotionValue(0);
  const likeOpacity = useTransform(x, [0, 60, 140], [0, 0.4, 1]);
  const nopeOpacity = useTransform(x, [-140, -60, 0], [1, 0.4, 0]);
  const cardRotate = useTransform(x, [-200, 0, 200], [-6, 0, 6]);
  const cardScale = useTransform(x, [-200, 0, 200], [0.97, 1, 0.97]);
  const swipedRef = useRef(false);
  const lastTapTimestampRef = useRef(0);
  const touchGestureRef = useRef<TouchGestureState | null>(null);
  const tapHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTapHint, setShowTapHint] = useState(false);

  const imageUrl = resolveImageUrl(job.job_image_url);

  const clearTapHint = useCallback(() => {
    if (tapHintTimerRef.current) {
      clearTimeout(tapHintTimerRef.current);
      tapHintTimerRef.current = null;
    }
    setShowTapHint(false);
  }, []);

  const armTapHint = useCallback(() => {
    clearTapHint();
    setShowTapHint(true);
    tapHintTimerRef.current = setTimeout(() => {
      tapHintTimerRef.current = null;
      setShowTapHint(false);
      lastTapTimestampRef.current = 0;
    }, TAP_HINT_DURATION);
  }, [clearTapHint]);

  useEffect(() => () => {
    if (tapHintTimerRef.current) {
      clearTimeout(tapHintTimerRef.current);
    }
  }, []);

  const triggerSwipe = useCallback((direction: SwipeDirection) => {
    lastTapTimestampRef.current = 0;
    clearTapHint();

    if (direction === 'right') {
      // Like: snap back and open apply sheet (don't animate away)
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 25 });
      onSwipeRight();
      return;
    }

    // Left swipe: animate away
    swipedRef.current = true;
    animate(x, -EXIT_X, {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    });

    setTimeout(() => {
      onSwipeLeft();
      swipedRef.current = false;
      x.set(0);
    }, 250);
  }, [clearTapHint, onSwipeLeft, onSwipeRight, x]);

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

    animate(x, 0, { type: 'spring', stiffness: 500, damping: 25 });
  }, [clearTapHint, triggerSwipe, x]);

  const handleTouchStartCapture = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (!useTouchTunnel || swipedRef.current || event.touches.length !== 1) return;

    const touch = event.touches[0];
    touchGestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isDragging: false,
      cancelled: false,
    };
  }, [useTouchTunnel]);

  const handleTouchMoveCapture = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (!useTouchTunnel || swipedRef.current || event.touches.length !== 1) return;

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
      lastTapTimestampRef.current = 0;
      clearTapHint();
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    x.set(deltaX);
  }, [clearTapHint, useTouchTunnel, x]);

  const handleTouchEndCapture = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (!useTouchTunnel) return;

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

      animate(x, 0, { type: 'spring', stiffness: 500, damping: 25 });
      return;
    }

    if (movedDistance > TAP_MOVE_THRESHOLD || pressDuration > TAP_MAX_DURATION) {
      lastTapTimestampRef.current = 0;
      clearTapHint();
      return;
    }

    const now = Date.now();

    if (showTapHint || now - lastTapTimestampRef.current <= DOUBLE_TAP_DELAY) {
      clearTapHint();
      lastTapTimestampRef.current = 0;
      onTap();
      return;
    }

    lastTapTimestampRef.current = now;
    armTapHint();
  }, [armTapHint, clearTapHint, onTap, triggerSwipe, useTouchTunnel, x, showTapHint]);

  const handleTouchCancelCapture = useCallback(() => {
    clearTapHint();
    touchGestureRef.current = null;
    if (!swipedRef.current) {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 25 });
    }
  }, [clearTapHint, x]);

  return (
    <div
      className="h-full w-full flex flex-col px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-[calc(env(safe-area-inset-top,0px)+4.75rem)]"
      style={sectionHeight ? { height: sectionHeight } : undefined}
    >
      {/* Card area with swipe */}
      <motion.div
        className="relative min-h-0 flex-1 rounded-2xl overflow-hidden shadow-2xl select-none [-webkit-tap-highlight-color:transparent]"
        style={{
          x,
          rotate: cardRotate,
          scale: cardScale,
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
        {/* Background image */}
        <div className="absolute inset-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={job.title}
              className="w-full h-full object-cover"
              style={{
                objectPosition: getImageObjectPosition(job.image_focus_position),
              }}
              loading={isVisible ? 'eager' : 'lazy'}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)]">
              <div className="absolute inset-0 flex items-center justify-center pt-[30%]">
                <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white/50 tracking-wide select-none">
                    {job.company_name
                      ? job.company_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                      : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* SÖKA stamp */}
        <motion.div
          className="absolute top-8 left-6 z-20 border-4 border-green-400 rounded-lg px-4 py-1 -rotate-12 pointer-events-none"
          style={{ opacity: likeOpacity }}
        >
          <span className="text-green-400 text-2xl font-black tracking-wider">SÖK</span>
        </motion.div>

        {/* TYCKER INTE OM stamp */}
        <motion.div
          className="absolute top-8 right-6 z-20 border-4 border-red-400 rounded-lg px-3 py-1 rotate-12 pointer-events-none"
          style={{ opacity: nopeOpacity }}
        >
          <span className="text-red-400 text-lg font-black tracking-wider">TYCKER INTE OM</span>
        </motion.div>

        {/* Applied stamp overlay */}
        {applied && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="-rotate-[18deg] border-[6px] border-green-500 rounded-xl px-8 py-3 bg-black/20 backdrop-blur-sm">
              <span className="text-green-500 text-4xl font-black tracking-widest uppercase">SÖKT ✓</span>
            </div>
          </div>
        )}

        {/* Text content */}
        <div className="absolute inset-x-0 top-[20%] bottom-28 z-10 flex items-center justify-center px-6 text-center">
          <div className="mx-auto w-full max-w-[21rem]">
            <p className="text-white font-bold text-lg">{job.company_name}</p>
            <h2
              className="mt-1 text-[clamp(1.58rem,6.4vw,2.1rem)] font-extrabold text-white leading-[1.08] tracking-tight"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {job.title}
            </h2>
            <p className="text-white font-semibold text-base mt-2 truncate">
              {[job.employment_type && getEmploymentTypeLabel(job.employment_type), job.location].filter(Boolean).join(' • ')}
            </p>
          </div>
        </div>

        {showTapHint && (
          <div className="absolute inset-x-0 bottom-24 z-20 flex justify-center px-5 pointer-events-none">
            <div className="rounded-full border border-white/20 bg-black/45 px-4 py-2 backdrop-blur-md">
              <span className="text-sm font-semibold text-white">Tryck igen för jobbinfo</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="absolute inset-x-0 bottom-4 z-10 px-5">
          <div className="mt-4 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSwipe('left'); }}
              className="w-[52px] h-[52px] rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-[0.93] transition-transform touch-manipulation"
            >
              <X className="w-6 h-6 text-white" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSave(); }}
              className="w-[52px] h-[52px] rounded-full bg-secondary border border-white/25 flex items-center justify-center shadow-lg shadow-secondary/30 active:scale-[0.93] transition-transform touch-manipulation"
            >
              <Bookmark className={`w-6 h-6 ${saved ? 'text-white fill-white' : 'text-white'}`} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSwipe('right'); }}
              className="w-[52px] h-[52px] rounded-full bg-green-500 flex items-center justify-center shadow-lg active:scale-[0.93] transition-transform touch-manipulation"
            >
              <Heart className="w-6 h-6 text-white fill-white" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Scroll hint on last card */}
    </div>
  );
});
