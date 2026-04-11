import { memo, useCallback, useEffect, useRef, useState, useMemo, type TouchEvent as ReactTouchEvent } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { CheckCircle, X, Bookmark, Heart, Users, Gift, Undo2 } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { useInputCapability } from '@/hooks/useInputCapability';
import { supabase } from '@/integrations/supabase/client';
import { imageCache } from '@/lib/imageCache';
import { differenceInDays, format, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import type { SwipeJob } from './SwipeCard';

function resolveImageUrl(url?: string, bucket = 'job-images'): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const { data } = supabase.storage.from(bucket).getPublicUrl(url);
  return data?.publicUrl || null;
}

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
  onActivate?: () => void;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSave: () => void;
  onTap: () => void;
  onUndo?: () => void;
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
const EXIT_X = typeof window !== 'undefined' ? window.innerWidth * 1.4 : 600;
const SNAP_SPRING = { type: 'spring' as const, stiffness: 340, damping: 28, mass: 0.9 };
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

function isWithinTapHintTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-tap-hint-scroll]'));
}

function isWithinInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(
    target.closest('button, a, input, textarea, select, [role="button"], [data-swipe-action-button]'),
  );
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
  onActivate,
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
  // Combine drag scale with entry animation scale
  const combinedScale = useTransform([cardScale, entryScale], ([cs, es]) => (cs as number) * (es as number));
  // Underlay: driven by explicit timed animation, NOT drag progress
  const underlayY = useMotionValue(800);
  const underlayScale = useMotionValue(0.68);
  const underlayOpacity = useMotionValue(0);
  const swipedRef = useRef(false);
  const lastTapTimestampRef = useRef(0);
  const touchGestureRef = useRef<TouchGestureState | null>(null);
  const [showTapHint, setShowTapHint] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const imageUrl = resolveImageUrl(job.job_image_url);
  const nextImageUrl = useMemo(() => resolveImageUrl(nextJob?.job_image_url), [nextJob?.job_image_url]);
  const rawLogoUrl = useMemo(() => resolveImageUrl(job.company_logo_url, 'company-logos'), [job.company_logo_url]);
  const cachedLogoBlob = useMemo(() => rawLogoUrl ? imageCache.getCachedUrl(rawLogoUrl) : null, [rawLogoUrl]);
  const [loadedLogoBlob, setLoadedLogoBlob] = useState<string | null>(null);
  const [logoBlobFailed, setLogoBlobFailed] = useState(false);
  useEffect(() => {
    if (!rawLogoUrl || cachedLogoBlob) { setLoadedLogoBlob(null); return; }
    setLogoBlobFailed(false);
    let cancelled = false;
    imageCache.loadImage(rawLogoUrl).then(b => { if (!cancelled) setLoadedLogoBlob(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [rawLogoUrl, cachedLogoBlob]);
  const logoUrl = logoBlobFailed ? rawLogoUrl : (cachedLogoBlob || loadedLogoBlob || rawLogoUrl);

  const handleLogoError = useMemo(() => {
    return (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (e.currentTarget.src.startsWith('blob:')) {
        if (rawLogoUrl) imageCache.evict(rawLogoUrl);
        setLogoBlobFailed(true);
      }
    };
  }, [rawLogoUrl]);

  const isTitleTruncated = useCallback(() => {
    const el = titleRef.current;
    if (!el) return false;
    return el.scrollHeight > el.clientHeight + 1;
  }, []);

  const tapHintTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const clearTapHint = useCallback(() => {
    setShowTapHint(false);
    if (tapHintTimerRef.current) clearTimeout(tapHintTimerRef.current);
  }, []);

  const armTapHint = useCallback(() => {
    clearTapHint();
    setShowTapHint(true);
    // Auto-dismiss only when title is NOT truncated (simple hint text)
    if (!isTitleTruncated()) {
      tapHintTimerRef.current = setTimeout(() => setShowTapHint(false), 1800);
    }
  }, [clearTapHint, isTitleTruncated]);
  // Clear tap hint immediately when any overlay opens/closes
  useEffect(() => {
    if (overlayOpen) clearTapHint();
  }, [overlayOpen, clearTapHint]);

  const triggerSwipe = useCallback((direction: SwipeDirection) => {
    lastTapTimestampRef.current = 0;
    clearTapHint();

    if (direction === 'right') {
      animate(x, 0, SNAP_SPRING);
      onSwipeRight();
      return;
    }

    swipedRef.current = true;

    // Premium exit: slide current card out
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

    // Premium underlay reveal: slow, graceful rise from below
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
      // Reset underlay for next swipe
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

    const scrollContainer = event.currentTarget.closest('[data-swipe-scroll-container="true"]');
    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.scrollTo({ top: scrollContainer.scrollTop, behavior: 'auto' });
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
      onActivate?.();
      lastTapTimestampRef.current = 0;
      clearTapHint();
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    x.set(deltaX);
  }, [clearTapHint, onActivate, useTouchTunnel, x]);

  const handleTouchEndCapture = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (
      !useTouchTunnel ||
      isWithinTapHintTarget(event.target) ||
      isWithinInteractiveTarget(event.target)
    ) {
      touchGestureRef.current = null;
      return;
    }

    // Reject if overlay is open or was very recently closed (prevents tap-through)
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
      // Tooltip is visible → dismiss it, don't open job info
      clearTapHint();
      lastTapTimestampRef.current = 0;
      return;
    }

    // Check if tap was on the title area
    const isTapOnTitle = event.target instanceof Element && Boolean(event.target.closest('[data-title-tap-zone]'));

    if (isTapOnTitle) {
      // Tap on title → show tooltip (don't open job info)
      armTapHint();
      return;
    }

    // Quick double-tap anywhere → open job info (keep as fallback)
    if (now - lastTapTimestampRef.current <= DOUBLE_TAP_DELAY) {
      clearTapHint();
      lastTapTimestampRef.current = 0;
      onTap();
      return;
    }

    // Single tap outside title → open job info directly
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

  // Track when card becomes active to trigger fade-in
  const prevActiveRef = useRef(isActive);

  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      entryScale.set(1);
    }
    prevActiveRef.current = isActive;
  }, [entryScale, isActive]);

  // Undo entry: slide card back from the left with a premium spring
  useEffect(() => {
    if (isUndoEntry && isActive) {
      x.set(-400);
      exitOpacity.set(0.3);
      animate(x, 0, {
        type: 'spring',
        stiffness: 180,
        damping: 24,
        mass: 0.9,
      });
      animate(exitOpacity, 1, {
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      });
    }
  }, [isUndoEntry, isActive, x, exitOpacity]);

  return (
    <div
      className="h-full w-full flex flex-col px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-[calc(env(safe-area-inset-top,0px)+4.75rem)]"
      style={sectionHeight ? { height: sectionHeight } : undefined}
    >
      {/* Card area with swipe */}
      <div className="relative min-h-0 flex-1">
        {nextJob && isActive && !overlayOpen && (
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl pointer-events-none"
            style={{
              y: underlayY,
              scale: underlayScale,
              opacity: underlayOpacity,
            }}
          >
            {/* Background image */}
            <div className="absolute inset-0">
              {nextImageUrl ? (
                <img
                  src={nextImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{
                    objectPosition: getImageObjectPosition(nextJob.image_focus_position),
                  }}
                  loading="eager"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)]" />
              )}
            </div>

            {/* Gradient — matches active card exactly */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

            {/* Category badge */}
            {nextJob.occupation && (
              <div className="absolute top-5 left-5 z-10">
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                  <span className="text-xs font-semibold tracking-wide text-white">{nextJob.occupation}</span>
                </div>
              </div>
            )}

            {/* Full content — identical to active card so nothing flashes on transition */}
            <div
              className="absolute inset-x-0 top-[20%] bottom-28 z-10 flex items-center justify-center px-6 text-center"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)' }}
            >
              <div className="mx-auto w-full max-w-[21rem]">
                {/* Company logo or initials — same logic as active card */}
                {(!nextImageUrl || nextJob.company_logo_url) && nextJob.company_name && (
                  <div className="flex justify-center mb-4">
                    {nextJob.company_logo_url ? (
                      <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center overflow-hidden shadow-lg">
                        <img
                          src={resolveImageUrl(nextJob.company_logo_url, 'company-logos') || ''}
                          alt=""
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                        <span className="text-xl font-bold text-white/40 tracking-wide select-none">
                          {nextJob.company_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-lg font-bold text-white">{nextJob.company_name}</p>
                <h3 className="mt-1 line-clamp-2 text-[clamp(1.58rem,6.4vw,2.1rem)] font-extrabold leading-[1.08] tracking-tight text-white">
                  {nextJob.title}
                </h3>
                <p className="mt-2 truncate text-base font-semibold text-white">
                  {[nextJob.employment_type && getEmploymentTypeLabel(nextJob.employment_type), nextJob.location].filter(Boolean).join(' • ')}
                </p>
                {/* Badges — salary, date, benefits, applicants */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  {(() => {
                    let salaryText: string | null = null;
                    const typeLabel = nextJob.salary_type === 'monthly' || nextJob.salary_type === 'fast' ? 'kr/mån'
                      : nextJob.salary_type === 'hourly' || nextJob.salary_type === 'rorlig' ? 'kr/tim'
                      : nextJob.salary_type === 'fast-rorlig' ? 'kr/mån' : 'kr/mån';
                    if (nextJob.salary_transparency === 'after_interview') {
                      salaryText = 'Lön efter intervju';
                    } else if (nextJob.salary_min || nextJob.salary_max) {
                      if (nextJob.salary_min && nextJob.salary_max) {
                        salaryText = `${nextJob.salary_min.toLocaleString('sv-SE')} – ${nextJob.salary_max.toLocaleString('sv-SE')} ${typeLabel}`;
                      } else {
                        salaryText = `Från ${(nextJob.salary_min || nextJob.salary_max)!.toLocaleString('sv-SE')} ${typeLabel}`;
                      }
                    } else if (nextJob.salary_transparency && /^\d/.test(nextJob.salary_transparency)) {
                      const match = nextJob.salary_transparency.match(/^(\d+)\s*[-–]\s*(\d+)$/);
                      if (match) {
                        salaryText = `${parseInt(match[1], 10).toLocaleString('sv-SE')} – ${parseInt(match[2], 10).toLocaleString('sv-SE')} ${typeLabel}`;
                      } else {
                        salaryText = `${nextJob.salary_transparency} ${typeLabel}`;
                      }
                    }
                    if (!salaryText) return null;
                    return (
                      <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
                        <span className="text-white text-xs font-semibold">{salaryText}</span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const publishedDate = format(parseISO(nextJob.created_at), 'd MMM', { locale: sv });
                    const daysLeft = nextJob.expires_at ? differenceInDays(parseISO(nextJob.expires_at), new Date()) : null;
                    const parts: string[] = [`Publicerad ${publishedDate}`];
                    if (daysLeft !== null && daysLeft >= 0) {
                      parts.push(daysLeft === 0 ? 'Sista dagen' : `${daysLeft} dagar kvar`);
                    }
                    return (
                      <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
                        <span className="text-white text-xs font-semibold">{parts.join(' • ')}</span>
                      </div>
                    );
                  })()}
                  {nextJob.benefits && nextJob.benefits.length > 0 && (
                    <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-1.5">
                      <Gift className="w-3 h-3 text-white" />
                      <span className="text-white text-xs font-semibold">
                        Förmåner {nextJob.benefits.length <= 5 ? `${nextJob.benefits.length} st` : `${Math.floor(nextJob.benefits.length / 5) * 5}+`}
                      </span>
                    </div>
                  )}
                  {nextJob.applications_count > 0 && (
                    <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-white" />
                      <span className="text-white text-xs font-semibold">
                        {nextJob.applications_count} sökande
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons — visual ghost for seamless transition */}
            <div className="absolute inset-x-0 bottom-4 z-10 px-5">
              <div className="mt-4 flex items-center justify-center gap-5">
                <div className="w-[52px] h-[52px] rounded-full bg-destructive/70 flex items-center justify-center shadow-lg">
                  <X className="w-6 h-6 text-white/70" strokeWidth={2.5} />
                </div>
                <div className="w-[52px] h-[52px] rounded-full bg-secondary/70 border border-white/20 flex items-center justify-center shadow-lg">
                  <Bookmark className="w-6 h-6 text-white/70" />
                </div>
                <div className="w-[52px] h-[52px] rounded-full bg-green-500/70 flex items-center justify-center shadow-lg">
                  <Heart className="w-6 h-6 text-white/70 fill-white/70" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          className="relative h-full rounded-2xl overflow-hidden shadow-2xl select-none [-webkit-tap-highlight-color:transparent]"
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
            <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)]" />
          )}
        </div>

        {/* Initials watermark removed – moved into text content block below */}

        {/* Gradient overlay – stronger for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

        {/* Category badge at top */}
        {job.occupation && (
          <div className="absolute top-5 left-5 z-10 pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
              <span className="text-white text-xs font-semibold tracking-wide">{job.occupation}</span>
            </div>
          </div>
        )}

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
          <div className="absolute top-4 left-4 z-30 pointer-events-none">
            <div className="-rotate-[12deg] border-[3px] border-green-500 rounded-lg px-4 py-1.5 bg-black/30 backdrop-blur-sm">
              <span className="text-green-500 text-lg font-black tracking-widest uppercase">SÖKT ✓</span>
            </div>
          </div>
        )}

        {/* Skipped stamp overlay */}
        {skipped && !applied && (
          <div className="absolute top-4 left-4 z-30 pointer-events-none">
            <div className="-rotate-[12deg] border-[3px] border-white/40 rounded-lg px-4 py-1.5 bg-black/30 backdrop-blur-sm">
              <span className="text-white/60 text-lg font-black tracking-widest uppercase">SKIPPAD</span>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-[20%] bottom-28 z-10 flex items-center justify-center px-6 text-center" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)' }}>
          <div className="mx-auto w-full max-w-[21rem]">
            {/* Company logo or initials fallback */}
            {(logoUrl || !imageUrl) && job.company_name && (
              <div className="flex justify-center mb-4">
                {logoUrl ? (
                  <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center overflow-hidden shadow-lg">
                    <img
                      src={logoUrl}
                      alt={job.company_name}
                      className="w-full h-full object-cover"
                      draggable={false}
                      onError={handleLogoError}
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                    <span className="text-xl font-bold text-white/40 tracking-wide select-none">
                      {job.company_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                )}
              </div>
            )}
            <p className="text-white font-bold text-lg">{job.company_name}</p>
            <h2
              ref={titleRef}
              data-title-tap-zone
              className="mt-1 text-[clamp(1.58rem,6.4vw,2.1rem)] font-extrabold text-white leading-[1.08] tracking-tight line-clamp-2"
            >
              {job.title}
            </h2>
            <p className="text-white font-semibold text-base mt-2 truncate">
              {[job.employment_type && getEmploymentTypeLabel(job.employment_type), job.location].filter(Boolean).join(' • ')}
            </p>
            {/* Salary + Date badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              {/* 1. Salary badge */}
              {(() => {
                let salaryText: string | null = null;
                const typeLabel = job.salary_type === 'monthly' || job.salary_type === 'fast' ? 'kr/mån'
                  : job.salary_type === 'hourly' || job.salary_type === 'rorlig' ? 'kr/tim'
                  : job.salary_type === 'fast-rorlig' ? 'kr/mån' : 'kr/mån';

                if (job.salary_transparency === 'after_interview') {
                  salaryText = 'Lön efter intervju';
                } else if (job.salary_min || job.salary_max) {
                  if (job.salary_min && job.salary_max) {
                    salaryText = `${job.salary_min.toLocaleString('sv-SE')} – ${job.salary_max.toLocaleString('sv-SE')} ${typeLabel}`;
                  } else {
                    salaryText = `Från ${(job.salary_min || job.salary_max)!.toLocaleString('sv-SE')} ${typeLabel}`;
                  }
                } else if (job.salary_transparency && /^\d/.test(job.salary_transparency)) {
                  const match = job.salary_transparency.match(/^(\d+)\s*[-–]\s*(\d+)$/);
                  if (match) {
                    const min = parseInt(match[1], 10);
                    const max = parseInt(match[2], 10);
                    salaryText = `${min.toLocaleString('sv-SE')} – ${max.toLocaleString('sv-SE')} ${typeLabel}`;
                  } else {
                    salaryText = `${job.salary_transparency} ${typeLabel}`;
                  }
                }

                if (!salaryText) return null;
                return (
                  <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
                    <span className="text-white text-xs font-semibold">{salaryText}</span>
                  </div>
                );
              })()}
              {/* 2. Published + days left badge */}
              {(() => {
                const publishedDate = format(parseISO(job.created_at), 'd MMM', { locale: sv });
                const daysLeft = job.expires_at ? differenceInDays(parseISO(job.expires_at), new Date()) : null;
                const parts: string[] = [`Publicerad ${publishedDate}`];
                if (daysLeft !== null && daysLeft >= 0) {
                  parts.push(daysLeft === 0 ? 'Sista dagen' : `${daysLeft} dagar kvar`);
                }
                return (
                  <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
                    <span className="text-white text-xs font-semibold">{parts.join(' • ')}</span>
                  </div>
                );
              })()}
              {/* 3. Benefits count badge */}
              {job.benefits && job.benefits.length > 0 && (
                <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-1.5">
                  <Gift className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-semibold">
                    Förmåner {job.benefits.length <= 5 ? `${job.benefits.length} st` : `${Math.floor(job.benefits.length / 5) * 5}+`}
                  </span>
                </div>
              )}
              {/* 4. Applicants count badge */}
              {job.applications_count > 0 && (
                <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-semibold">
                    {job.applications_count} sökande
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {showTapHint && isTitleTruncated() && (
          <div className="absolute inset-x-4 bottom-24 z-30 pointer-events-none">
            <div
              data-tap-hint-scroll
              className="pointer-events-auto rounded-xl border border-white/20 bg-slate-900/95 px-4 py-3 backdrop-blur-md shadow-2xl max-h-[300px] overflow-y-auto overscroll-contain touch-pan-y"
            >
              <p className="text-sm font-semibold text-white leading-relaxed break-words whitespace-pre-wrap">{job.title}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="absolute inset-x-0 bottom-4 z-10 px-5">
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSwipe('left'); }}
              data-swipe-action-button
              className="w-[52px] h-[52px] rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-[0.93] transition-transform touch-manipulation"
            >
              <X className="w-6 h-6 text-white" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSave(); }}
              data-swipe-action-button
              className="w-[52px] h-[52px] rounded-full bg-secondary border border-white/25 flex items-center justify-center shadow-lg shadow-secondary/30 active:scale-[0.93] transition-transform touch-manipulation"
            >
              <Bookmark className={`w-6 h-6 ${saved ? 'text-white fill-white' : 'text-white'}`} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSwipe('right'); }}
              data-swipe-action-button
              className="w-[52px] h-[52px] rounded-full bg-green-500 flex items-center justify-center shadow-lg active:scale-[0.93] transition-transform touch-manipulation"
            >
              <Heart className="w-6 h-6 text-white fill-white" />
            </button>
            {canUndo && onUndo && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUndo(); }}
                data-swipe-action-button
                className="w-[44px] h-[44px] rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg active:scale-[0.93] transition-transform touch-manipulation"
              >
                <Undo2 className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
        </motion.div>
      </div>

      {/* Scroll hint on last card */}
    </div>
  );
});
