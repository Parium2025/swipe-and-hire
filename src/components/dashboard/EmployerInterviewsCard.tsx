import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CalendarPlus, Video, Building2, CheckCircle2, Clock3, Hourglass, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TruncatedText } from '@/components/ui/truncated-text';
import { useInterviews, Interview } from '@/hooks/useInterviews';
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
import { DashboardCarouselDots } from './DashboardCarouselDots';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTouchCapable } from '@/hooks/useInputCapability';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

const getLocationIcon = (type: Interview['location_type']) => {
  switch (type) {
    case 'video': return Video;
    case 'office': return Building2;
    default: return Calendar;
  }
};

const getLocationLabel = (type: Interview['location_type']) => {
  switch (type) {
    case 'video': return 'Video';
    case 'office': return 'Kontor';
    default: return '';
  }
};

export const EmployerInterviewsCard = memo(() => {
  const { interviews, isLoading, error, dismissInterview } = useInterviews();
  const navigate = useNavigate();
  const now = useMinuteTick();
  const isSmallScreen = useIsMobile();
  const isTouchCapable = useTouchCapable();
  const useTouchCarousel = isSmallScreen && isTouchCapable;
  // Dubbeltryck (vanligt på mobil) ska inte öppna två mötesflikar.
  const lastOpenRef = useRef(0);
  const lastSwipeRef = useRef(0);
  // Mobil: en intervju per kortyta, prickar växlar mellan dem.
  const [mobileIndex, setMobileIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(1);
  // Bekräftelse innan ett möte plockas bort ur översikten.
  const [pendingDismiss, setPendingDismiss] = useState<Interview | null>(null);
  // Ett finger som rör sig (scroll/svep) får aldrig räknas som ett tryck.
  const touchMovedRef = useRef(false);

  // Avslutade och avböjda möten ligger kvar (hämtningen släpper dem efter ett
  // dygn) så att ingen kandidat glöms bort — men de sorteras efter de aktiva.
  const liveInterviews = useMemo(() => {
    const isDone = (i: Interview) =>
      i.status === 'declined' || isInterviewOver(i.scheduled_at, i.duration_minutes, now);
    return [...interviews].sort((a, b) => {
      const aDone = isDone(a) ? 1 : 0;
      const bDone = isDone(b) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const aTime = new Date(a.scheduled_at).getTime();
      const bTime = new Date(b.scheduled_at).getTime();
      // Aktiva: närmast i tiden först. Avslutade/avböjda: senaste först.
      return aDone ? bTime - aTime : aTime - bTime;
    });
  }, [interviews, now]);

  // Håll mobilindex giltigt när intervjuer tas bort eller läggs till.
  const activeIndex = Math.min(mobileIndex, Math.max(0, liveInterviews.length - 1));
  const showNext = useCallback(() => {
    if (liveInterviews.length <= 1) return;
    lastSwipeRef.current = Date.now();
    setSwipeDirection(1);
    setMobileIndex(current => (current + 1) % liveInterviews.length);
  }, [liveInterviews.length]);
  const showPrevious = useCallback(() => {
    if (liveInterviews.length <= 1) return;
    lastSwipeRef.current = Date.now();
    setSwipeDirection(-1);
    setMobileIndex(current => (current - 1 + liveInterviews.length) % liveInterviews.length);
  }, [liveInterviews.length]);
  const swipeHandlers = useSwipeGesture({ onSwipeLeft: showNext, onSwipeRight: showPrevious });
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
      onTouchStart={useTouchCarousel ? swipeHandlers.onTouchStart : undefined}
      onTouchMove={useTouchCarousel ? swipeHandlers.onTouchMove : undefined}
      onTouchEnd={useTouchCarousel ? swipeHandlers.onTouchEnd : undefined}
    >
      <div className="absolute inset-0 bg-white/5" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />

      <CardContent className="relative p-3 h-full flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 rounded-xl bg-white/10">
            <Calendar className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">INTERVJUER</span>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {liveInterviews.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Calendar className="h-8 w-8 text-white mb-2" />
              {/* Ett hämtningsfel får aldrig se ut som "inga intervjuer". */}
              <p className="text-sm font-medium text-white">
                {error ? 'Kunde inte hämta intervjuer' : 'Inga bokade intervjuer'}
              </p>
              {error && (
                <p className="text-xs text-white mt-1">Försök igen om en stund.</p>
              )}
            </div>
          ) : (
            <>
              <div className={cn(
                'flex-1 min-h-0 space-y-1.5 pr-1 scrollbar-hide',
                useTouchCarousel ? 'overflow-hidden' : 'overflow-y-auto',
              )}>
                <AnimatePresence mode="wait" initial={false} custom={swipeDirection}>
                {visibleInterviews.map((interview) => {
                  const LocationIcon = getLocationIcon(interview.location_type);
                  const isOver = isInterviewOver(interview.scheduled_at, interview.duration_minutes, now);
                  const isDeclined = interview.status === 'declined';
                  // Avböjda och avslutade möten får rensas bort manuellt.
                  const canDismiss = isDeclined || isOver;
                  const timeUntil = isDeclined
                    ? 'Avböjt'
                    : isOver
                      ? 'Avslutad'
                      : getTimeUntil(interview.scheduled_at, now);
                  // Kandidatens svar följer alltid med, även när mötet är avslutat.
                  const responseLabel = isDeclined
                    ? 'Tackade nej'
                    : interview.status === 'confirmed'
                      ? 'Tackade ja'
                      : 'Inget svar';
                  const isUrgent = !canDismiss && isInterviewUrgent(interview.scheduled_at, now);
                  const meetingUrl = getMeetingUrl(interview.location_details);

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
                        useTouchCarousel ? 'h-full min-h-[108px] px-3 py-2.5' : 'p-2',
                        canDismiss ? 'bg-white/5 hover:bg-white/10' : 'bg-white/10 hover:bg-white/15',
                      )}
                      onClick={() => {
                        const nowMs = Date.now();
                        if (nowMs - lastSwipeRef.current < 500) return;
                        if (nowMs - lastOpenRef.current < 800) return;
                        lastOpenRef.current = nowMs;
                        if (!canDismiss && interview.location_type === 'video' && meetingUrl) {
                          window.open(meetingUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          navigate('/my-candidates');
                        }
                      }}
                    >
                      <div className={cn('flex items-stretch justify-between gap-2', useTouchCarousel && 'h-full')}>
                        <div className="flex flex-1 min-w-0 flex-col">
                          <TruncatedText text={interview.candidate_name} className={cn('font-semibold text-white', useTouchCarousel ? 'text-sm' : 'text-xs')} insideInteractive />
                          <TruncatedText text={interview.job_title} className={cn('text-white', useTouchCarousel ? 'text-xs' : 'text-[10px]')} insideInteractive />
                          {useTouchCarousel && (
                            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white">
                              <span className="leading-none whitespace-nowrap">{formatInterviewDate(interview.scheduled_at)}</span>
                              <span className="leading-none whitespace-nowrap">kl {formatInterviewTimeWithZone(interview.scheduled_at)}</span>
                              <span className="flex items-center gap-1 leading-none whitespace-nowrap">
                                <LocationIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="leading-none">{getLocationLabel(interview.location_type)}</span>
                              </span>
                            </div>
                          )}
                        </div>
                        <div className={cn('flex shrink-0 flex-col items-center', useTouchCarousel ? 'w-[112px] gap-1.5' : 'w-[88px] gap-1')}>
                          <span className={cn(
                            'flex w-full items-center justify-center gap-1 rounded bg-white/10 font-medium leading-none whitespace-nowrap text-white',
                            useTouchCarousel ? 'h-7 px-2 text-xs' : 'h-5 px-1.5 text-[10px]',
                          )}>
                            {!canDismiss && <Clock3 className={cn('shrink-0', useTouchCarousel ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} aria-hidden="true" />}
                            {timeUntil}
                          </span>
                          {canDismiss ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                dismissInterview.mutate(interview.id);
                              }}
                              className={cn('flex w-full items-center justify-center gap-1 rounded bg-white/10 font-medium leading-none text-white hover:bg-white/15', useTouchCarousel ? 'h-7 px-2 text-xs' : 'h-5 px-1.5 text-[10px]')}
                              aria-label="Ta bort från översikten"
                            >
                              <Trash2 className={cn('shrink-0', useTouchCarousel ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} aria-hidden="true" />
                              <span className="leading-none">Ta bort</span>
                            </button>

                          ) : (
                            <span className={cn('flex w-full items-center justify-center gap-1 rounded bg-white/10 font-medium leading-none whitespace-nowrap text-white', useTouchCarousel ? 'h-7 px-2 text-xs' : 'h-5 px-1 text-[9px]')}>
                              {interview.status === 'confirmed' ? (
                                <CheckCircle2 className={cn('shrink-0', useTouchCarousel ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} aria-hidden="true" />
                              ) : (
                                <Hourglass className={cn('shrink-0', useTouchCarousel ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} aria-hidden="true" />
                              )}
                              {interview.status === 'confirmed' ? 'Bekräftad' : 'Inväntar svar'}
                            </span>
                          )}
                          {useTouchCarousel && (canDismiss ? (
                            <span className={cn('flex w-full items-center justify-center gap-1 rounded bg-white/10 font-medium leading-none whitespace-nowrap text-white', useTouchCarousel ? 'h-7 px-2 text-xs' : 'h-5 px-1.5 text-[10px]')}>
                              {interview.status === 'confirmed' ? (
                                <CheckCircle2 className={cn('shrink-0', useTouchCarousel ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} aria-hidden="true" />
                              ) : (
                                <Hourglass className={cn('shrink-0', useTouchCarousel ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} aria-hidden="true" />
                              )}
                              <span className="leading-none">{responseLabel}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void downloadInterviewIcs(interview.id);
                              }}
                              className={cn('flex w-full items-center justify-center gap-1 rounded bg-white/10 font-medium leading-none text-white hover:bg-white/15', useTouchCarousel ? 'h-7 px-2 text-xs' : 'h-5 px-1.5 text-[10px]')}
                              aria-label="Lägg till i kalender"
                            >
                              <CalendarPlus className={cn('shrink-0', useTouchCarousel ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} aria-hidden="true" />
                              <span className="leading-none">Kalender</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      {!useTouchCarousel && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] leading-none text-white">
                          <span className="leading-none whitespace-nowrap">{formatInterviewDate(interview.scheduled_at)}</span>
                          <span className="leading-none whitespace-nowrap">kl {formatInterviewTimeWithZone(interview.scheduled_at)}</span>
                          <span className="flex items-center gap-1 leading-none whitespace-nowrap">
                            <LocationIcon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                            <span className="leading-none">{getLocationLabel(interview.location_type)}</span>
                          </span>
                          {canDismiss ? (
                            <span className="ml-auto flex h-auto items-center gap-1 rounded bg-white/10 px-2 py-0.5 leading-none text-white whitespace-nowrap">
                              {interview.status === 'confirmed' ? (
                                <CheckCircle2 className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <Hourglass className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              )}
                              <span className="leading-none">{responseLabel}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void downloadInterviewIcs(interview.id);
                              }}
                              className="ml-auto flex h-5 w-[76px] items-center justify-start gap-1 rounded bg-transparent px-1 py-0.5 leading-none text-white hover:bg-white/15"
                              aria-label="Lägg till i kalender"
                            >
                              <CalendarPlus className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              <span className="leading-none">Kalender</span>
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>

              {useTouchCarousel && (
                <DashboardCarouselDots
                  count={liveInterviews.length}
                  currentIndex={activeIndex}
                  onSelect={(index) => {
                    setSwipeDirection(index >= activeIndex ? 1 : -1);
                    setMobileIndex(index);
                  }}
                  label="Visa intervju"
                  alwaysRender
                  maxVisible={4}
                />
              )}
            </>
          )}
        </div>

      </CardContent>
    </Card>
  );
});

EmployerInterviewsCard.displayName = 'EmployerInterviewsCard';
