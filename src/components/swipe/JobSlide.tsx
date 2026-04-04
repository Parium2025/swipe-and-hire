import { memo, useCallback, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { Building2, CheckCircle, X, Bookmark, Heart } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { useInputCapability } from '@/hooks/useInputCapability';
import { supabase } from '@/integrations/supabase/client';
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

function getImageObjectPosition(value?: string): string {
  if (!value || value === 'center') return 'center 50%';
  if (value === 'top') return 'center 20%';
  if (value === 'bottom') return 'center 80%';
  return `center ${value}%`;
}

export const JobSlide = memo(function JobSlide({
  job,
  applied,
  isVisible,
  isLast,
  sectionHeight,
  onSwipeRight,
  onSwipeLeft,
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

  const imageUrl = resolveImageUrl(job.job_image_url);

  const triggerSwipe = useCallback((direction: SwipeDirection) => {
    lastTapTimestampRef.current = 0;
    swipedRef.current = true;

    animate(x, direction === 'right' ? EXIT_X : -EXIT_X, {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    });

    setTimeout(() => {
      if (direction === 'right') {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }

      swipedRef.current = false;
      x.set(0);
    }, 250);
  }, [onSwipeLeft, onSwipeRight, x]);

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
    }

    animate(x, 0, { type: 'spring', stiffness: 500, damping: 25 });
  }, [triggerSwipe, x]);

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
        return;
      }

      gesture.isDragging = true;
      lastTapTimestampRef.current = 0;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    x.set(deltaX);
  }, [useTouchTunnel, x]);

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
      return;
    }

    const now = Date.now();

    if (now - lastTapTimestampRef.current <= DOUBLE_TAP_DELAY) {
      lastTapTimestampRef.current = 0;
      onTap();
      return;
    }

    lastTapTimestampRef.current = now;
  }, [onTap, triggerSwipe, useTouchTunnel, x]);

  const handleTouchCancelCapture = useCallback(() => {
    touchGestureRef.current = null;
    if (!swipedRef.current) {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 25 });
    }
  }, [x]);

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
            <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)] flex items-center justify-center">
              <Building2 className="w-24 h-24 text-white/10" />
            </div>
          )}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* LIKE stamp */}
        <motion.div
          className="absolute top-8 left-6 z-20 border-4 border-green-400 rounded-lg px-4 py-1 -rotate-12 pointer-events-none"
          style={{ opacity: likeOpacity }}
        >
          <span className="text-green-400 text-3xl font-black tracking-wider">LIKE</span>
        </motion.div>

        {/* NOPE stamp */}
        <motion.div
          className="absolute top-8 right-6 z-20 border-4 border-red-400 rounded-lg px-4 py-1 rotate-12 pointer-events-none"
          style={{ opacity: nopeOpacity }}
        >
          <span className="text-red-400 text-3xl font-black tracking-wider">NOPE</span>
        </motion.div>

        {/* Applied badge */}
        {applied && (
          <div className="absolute top-6 left-6 z-20">
            <div className="flex items-center gap-1.5 bg-green-500/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
              <CheckCircle className="h-3.5 w-3.5" />
              Redan sökt
            </div>
          </div>
        )}

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          <p className="text-white/80 font-medium text-sm">{job.company_name}</p>
          <h2 className="text-xl font-bold text-white leading-snug tracking-tight mt-0.5 line-clamp-2">{job.title}</h2>
          <p className="text-white/70 text-sm mt-1.5 truncate">
            {[job.employment_type && getEmploymentTypeLabel(job.employment_type), job.location].filter(Boolean).join(' • ')}
          </p>

          {/* Hint */}
          <div className="mt-3 flex items-center justify-center">
            <span className="text-white/40 text-xs">← Skippa · Dubbeltryck för mer · Gilla →</span>
          </div>
        </div>
      </motion.div>

      {/* Scroll hint on last card */}
    </div>
  );
});
