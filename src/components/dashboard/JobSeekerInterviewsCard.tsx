import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CalendarPlus, Clock3, Video, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TruncatedText } from '@/components/ui/truncated-text';
import { useCandidateInterviews } from '@/hooks/useInterviews';
import { useMinuteTick } from '@/hooks/useMinuteTick';
import {
  formatInterviewDate,
  formatInterviewTimeWithZone,
  getTimeUntil,
  isInterviewUrgent,
  isInterviewOver,
  getMeetingUrl,
} from '@/lib/interviewTime';
import { GRADIENTS } from './dashboardConstants';
import { downloadInterviewIcs } from '@/lib/downloadInterviewIcs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTouchCapable } from '@/hooks/useInputCapability';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

type LocationType = 'video' | 'office';

const getLocationIcon = (type: LocationType) => {
  switch (type) {
    case 'video': return Video;
    case 'office': return Building2;
    default: return Calendar;
  }
};

const getLocationLabel = (type: LocationType) => {
  switch (type) {
    case 'video': return 'Video';
    case 'office': return 'Kontor';
    default: return '';
  }
};

export const JobSeekerInterviewsCard = memo(() => {
  const { interviews, isLoading, isError, refetch } = useCandidateInterviews();
  const navigate = useNavigate();
  const now = useMinuteTick();

  // Kommande möten först, sedan nyss avslutade/avböjda (de ligger kvar ett dygn).
  const liveInterviews = useMemo(() => {
    const list = interviews as any[];
    const active = list.filter(
      (i) => i.status !== 'declined' && !isInterviewOver(i.scheduled_at, i.duration_minutes, now),
    );
    const finished = list.filter(
      (i) => i.status === 'declined' || isInterviewOver(i.scheduled_at, i.duration_minutes, now),
    );
    // Aktiva: närmast i tiden först. Avslutade: senaste först.
    active.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    finished.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    return [...active, ...finished];
  }, [interviews, now]);
  // Touchskärmar: en intervju per kortyta, svep för att bläddra (samma som arbetsgivarkortet).
  const isSmallScreen = useIsMobile();
  const isTouchCapable = useTouchCapable();
  const useTouchCarousel = isSmallScreen && isTouchCapable;
  const [mobileIndex, setMobileIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(1);
  const lastSwipeRef = useRef(0);
  const lastOpenRef = useRef(0);
  const touchMovedRef = useRef(false);
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeIndex = Math.min(mobileIndex, Math.max(0, liveInterviews.length - 1));
  const showNext = useCallback(() => {
    if (liveInterviews.length <= 1) return;
    lastSwipeRef.current = Date.now();
    setSwipeDirection(1);
    setMobileIndex(c => (c + 1) % liveInterviews.length);
  }, [liveInterviews.length]);
  const showPrevious = useCallback(() => {
    if (liveInterviews.length <= 1) return;
    lastSwipeRef.current = Date.now();
    setSwipeDirection(-1);
    setMobileIndex(c => (c - 1 + liveInterviews.length) % liveInterviews.length);
  }, [liveInterviews.length]);
  const swipeHandlers = useSwipeGesture({ onSwipeLeft: showNext, onSwipeRight: showPrevious, threshold: 32 });
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    touchMovedRef.current = false;
    const t = event.touches[0];
    touchStartPointRef.current = t ? { x: t.clientX, y: t.clientY } : null;
    if (useTouchCarousel) swipeHandlers.onTouchStart(event);
  }, [swipeHandlers, useTouchCarousel]);
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    const start = touchStartPointRef.current;
    const t = event.touches[0];
    if (start && t && (Math.abs(t.clientX - start.x) > 8 || Math.abs(t.clientY - start.y) > 8)) {
      touchMovedRef.current = true;
    }
    if (useTouchCarousel) swipeHandlers.onTouchMove(event);
  }, [swipeHandlers, useTouchCarousel]);
  const handleTouchEnd = useCallback(() => {
    if (useTouchCarousel) swipeHandlers.onTouchEnd();
  }, [swipeHandlers, useTouchCarousel]);
  const isAccidentalTap = useCallback(() => {
    if (touchMovedRef.current) { touchMovedRef.current = false; return true; }
    return Date.now() - lastSwipeRef.current < 500;
  }, []);
  const visibleInterviews = useTouchCarousel
    ? liveInterviews.slice(activeIndex, activeIndex + 1)
    : liveInterviews;

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.interviews} border-0 shadow-lg dashboard-card-height`}>
        <div className="absolute inset-0 bg-white/5" />
        <CardContent className="relative p-4 h-full">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-10 w-10 rounded-xl bg-white/20" />
            <Skeleton className="h-4 w-24 bg-white/20" />
          </div>
          <Skeleton className="h-16 w-full bg-white/10 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.interviews} border-0 shadow-lg dashboard-card-height touch-pan-y`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0 bg-white/5" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-3 h-full flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between mb-2 transform-gpu"
          style={{ backfaceVisibility: 'hidden', WebkitFontSmoothing: 'antialiased' }}
        >
          <div
            className="p-2 rounded-xl bg-white/10 transform-gpu"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <Calendar className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">INTERVJUER</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isError ? (
            <div
              className="flex-1 flex flex-col items-center justify-center text-center transform-gpu"
              style={{ backfaceVisibility: 'hidden', WebkitFontSmoothing: 'antialiased' }}
            >
              <Calendar className="h-8 w-8 text-white mb-2" />
              <p className="text-sm font-medium text-white">Kunde inte hämta intervjuerna</p>
              <button
                onClick={() => { void refetch(); }}
                className="text-xs text-white underline underline-offset-2 mt-1"
              >
                Försök igen
              </button>
            </div>
          ) : liveInterviews.length === 0 ? (
            <div
              className="flex-1 flex flex-col items-center justify-center text-center transform-gpu"
              style={{ backfaceVisibility: 'hidden', WebkitFontSmoothing: 'antialiased' }}
            >
              <Calendar className="h-8 w-8 text-white mb-2" />
              <p className="text-sm font-medium text-white">Inga bokade intervjuer</p>
              <p className="text-xs text-white mt-1">Fortsätt söka jobb!</p>
            </div>
          ) : (
            <>
              <div className={cn(
                'flex-1 min-h-0 scrollbar-hide',
                useTouchCarousel ? 'relative overflow-hidden' : 'space-y-1.5 pr-1 overflow-y-auto',
              )}>
                <AnimatePresence mode="sync" initial={false} custom={swipeDirection}>
                {visibleInterviews.map((interview: any) => {
                  const LocationIcon = getLocationIcon(interview.location_type);
                  const isOver = isInterviewOver(interview.scheduled_at, interview.duration_minutes, now);
                  const isDeclined = interview.status === 'declined';
                  const isDone = isDeclined || isOver;
                  const timeUntil = isDeclined ? 'Avböjt' : isOver ? 'Avslutad' : getTimeUntil(interview.scheduled_at, now);
                  const isUrgent = !isDone && isInterviewUrgent(interview.scheduled_at, now);
                  const meetingUrl = getMeetingUrl(interview.location_details);
                  const companyName = interview.job_postings?.workplace_name?.trim() || 'Okänt företag';

                  return (
                    <motion.div
                      key={interview.id}
                      custom={swipeDirection}
                      initial={useTouchCarousel ? { opacity: 0, x: swipeDirection * 28 } : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={useTouchCarousel ? { opacity: 0, x: swipeDirection * -28 } : undefined}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        'rounded-lg cursor-pointer transition-colors',
                        useTouchCarousel ? 'absolute inset-0 h-full min-h-[108px] px-3 py-2.5' : 'p-2',
                        isDone ? 'bg-white/5 hover:bg-white/10' : 'bg-white/10 hover:bg-white/15',
                      )}
                      onClick={() => {
                        const nowMs = Date.now();
                        if (isAccidentalTap()) return;
                        if (nowMs - lastOpenRef.current < 800) return;
                        lastOpenRef.current = nowMs;
                        if (!isDone && interview.location_type === 'video' && meetingUrl) {
                          window.open(meetingUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          navigate('/my-applications');
                        }
                      }}
                    >
                      {useTouchCarousel ? (
                        <div className="flex h-full items-stretch justify-between gap-2">
                          <div className="flex flex-1 min-w-0 flex-col">
                            <TruncatedText text={interview.job_postings?.title || 'Intervju'} className="text-sm font-semibold text-white" insideInteractive />
                            <TruncatedText text={companyName} className="text-xs text-white" insideInteractive />
                            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white">
                              <span className="leading-none whitespace-nowrap">{formatInterviewDate(interview.scheduled_at)}</span>
                              <span className="leading-none whitespace-nowrap">kl {formatInterviewTimeWithZone(interview.scheduled_at)}</span>
                              <span className="flex items-center gap-1 leading-none whitespace-nowrap">
                                <LocationIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="leading-none">{getLocationLabel(interview.location_type)}</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex w-[112px] shrink-0 flex-col items-center gap-1.5">
                            <span className="flex h-7 w-full items-center justify-center gap-1 rounded bg-white/10 px-2 text-xs font-medium leading-none whitespace-nowrap text-white">
                              {!isDone && <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                              {timeUntil}
                            </span>
                            {!isDone && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (isAccidentalTap()) return;
                                  void downloadInterviewIcs(interview.id);
                                }}
                                className="flex h-7 w-full items-center justify-center gap-1 rounded bg-white/10 px-2 text-xs font-medium leading-none text-white"
                                aria-label="Lägg till i kalender"
                              >
                                <CalendarPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="leading-none">Kalender</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <TruncatedText text={interview.job_postings?.title || 'Intervju'} className="text-xs font-semibold text-white" insideInteractive />
                              <TruncatedText text={companyName} className="text-[10px] text-white" insideInteractive />
                            </div>
                            <span className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap text-white",
                              isUrgent && "bg-white/20"
                            )}>
                              {timeUntil}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] leading-none text-white whitespace-nowrap">
                            <span className="leading-none">{formatInterviewDate(interview.scheduled_at)}</span>
                            <span className="leading-none">kl {formatInterviewTimeWithZone(interview.scheduled_at)}</span>
                            <span className="flex items-center gap-1 leading-none">
                              <LocationIcon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              <span className="leading-none">{getLocationLabel(interview.location_type)}</span>
                            </span>
                          </div>
                        </>
                      )}
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>

              {useTouchCarousel && (
                <div
                  className="mt-auto flex h-6 shrink-0 items-center justify-center"
                  aria-live="polite"
                  aria-label={`Intervju ${activeIndex + 1} av ${liveInterviews.length}`}
                >
                  <span className="inline-flex min-w-[4.75rem] items-center justify-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold leading-none tabular-nums text-white">
                    {activeIndex + 1} av {liveInterviews.length}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

JobSeekerInterviewsCard.displayName = 'JobSeekerInterviewsCard';
