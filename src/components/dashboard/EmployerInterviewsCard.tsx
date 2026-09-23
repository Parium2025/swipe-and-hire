import { memo, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  // Dubbeltryck (vanligt på mobil) ska inte öppna två mötesflikar.
  const lastOpenRef = useRef(0);
  // Mobil: en intervju per kortyta, prickar växlar mellan dem.
  const [mobileIndex, setMobileIndex] = useState(0);

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

  if (isLoading) {
    return (
      <Card className={`relative h-[200px] overflow-hidden bg-gradient-to-br ${GRADIENTS.interviews} border-0 shadow-lg md:h-[220px] lg:h-[240px]`}>
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
    <Card className={`relative h-[200px] overflow-hidden bg-gradient-to-br ${GRADIENTS.interviews} border-0 shadow-lg md:h-[220px] lg:h-[240px]`}>
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
              <div className="flex-1 min-h-0 space-y-1.5 sm:overflow-y-auto sm:pr-1 scrollbar-hide">
                {liveInterviews.map((interview, index) => {
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
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'rounded-lg px-3 py-2.5 sm:p-2 cursor-pointer transition-colors',
                        canDismiss ? 'bg-white/5 hover:bg-white/10' : 'bg-white/10 hover:bg-white/15',
                        // Mobil: endast den valda intervjun syns — en per kortyta.
                        index !== activeIndex && 'hidden sm:block',
                      )}
                      onClick={() => {
                        const nowMs = Date.now();
                        if (nowMs - lastOpenRef.current < 800) return;
                        lastOpenRef.current = nowMs;
                        if (!canDismiss && interview.location_type === 'video' && meetingUrl) {
                          window.open(meetingUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          navigate('/my-candidates');
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <TruncatedText text={interview.candidate_name} className="text-sm sm:text-xs font-semibold text-white" insideInteractive />
                          <TruncatedText text={interview.job_title} className="text-xs sm:text-[10px] text-white" insideInteractive />
                        </div>
                        <div className="flex w-[104px] sm:w-[88px] shrink-0 flex-col items-center gap-1.5 sm:gap-1">
                          <span className={cn(
                            "flex h-7 sm:h-5 w-full items-center justify-center gap-1 rounded px-2 sm:px-1.5 text-xs sm:text-[10px] font-medium leading-none whitespace-nowrap text-white",
                            (isUrgent || canDismiss) && "bg-white/10"
                          )}>
                            {!canDismiss && <Clock3 className="h-3.5 sm:h-2.5 w-3.5 sm:w-2.5 shrink-0" aria-hidden="true" />}
                            {timeUntil}
                          </span>
                          {canDismiss ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                dismissInterview.mutate(interview.id);
                              }}
                              className="flex h-7 sm:h-5 w-full items-center justify-center gap-1 rounded bg-white/10 px-2 sm:px-1.5 text-xs sm:text-[10px] font-medium leading-none text-white hover:bg-white/15"
                              aria-label="Ta bort från översikten"
                            >
                              <Trash2 className="h-3.5 sm:h-2.5 w-3.5 sm:w-2.5 shrink-0" aria-hidden="true" />
                              <span className="leading-none">Ta bort</span>
                            </button>

                          ) : (
                            <span className="flex h-7 sm:h-5 w-full items-center justify-center gap-1 rounded px-1 whitespace-nowrap text-xs sm:text-[9px] font-medium leading-none text-white">
                              {interview.status === 'confirmed' ? (
                                <CheckCircle2 className="h-3.5 sm:h-2.5 w-3.5 sm:w-2.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <Hourglass className="h-3.5 sm:h-2.5 w-3.5 sm:w-2.5 shrink-0" aria-hidden="true" />
                              )}
                              {interview.status === 'confirmed' ? 'Bekräftad' : 'Inväntar svar'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-2 mt-1.5 sm:mt-1 text-xs sm:text-[10px] leading-none text-white">
                        <span className="leading-none whitespace-nowrap">{formatInterviewDate(interview.scheduled_at)}</span>
                        <span className="leading-none whitespace-nowrap">kl {formatInterviewTimeWithZone(interview.scheduled_at)}</span>
                        <span className="flex items-center gap-1 leading-none whitespace-nowrap">
                          <LocationIcon className="h-3.5 sm:h-2.5 w-3.5 sm:w-2.5 shrink-0" aria-hidden="true" />
                          <span className="leading-none">{getLocationLabel(interview.location_type)}</span>
                        </span>
                        {canDismiss && (
                          <span className="ml-auto flex h-7 sm:h-auto items-center gap-1 rounded bg-white/10 px-2 py-0.5 leading-none text-white whitespace-nowrap">
                            {interview.status === 'confirmed' ? (
                              <CheckCircle2 className="h-3.5 sm:h-2.5 w-3.5 sm:w-2.5 shrink-0" aria-hidden="true" />
                            ) : (
                              <Hourglass className="h-3.5 sm:h-2.5 w-3.5 sm:w-2.5 shrink-0" aria-hidden="true" />
                            )}
                            <span className="leading-none">{responseLabel}</span>
                          </span>
                        )}
                        {!canDismiss && (
                          /* Fungerar även utan kopplad kalender: filen läggs in i
                             Google, Outlook eller Apple med samma id, så inget dubbleras. */
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void downloadInterviewIcs(interview.id);
                            }}
                            className="ml-auto flex h-7 sm:h-5 sm:w-[76px] items-center justify-center sm:justify-start gap-1 rounded bg-white/10 sm:bg-transparent px-2 sm:px-1 py-0.5 leading-none text-white hover:bg-white/15"
                            aria-label="Lägg till i kalender"
                          >
                            <CalendarPlus className="h-3.5 sm:h-2.5 w-3.5 sm:w-2.5 shrink-0" aria-hidden="true" />
                            <span className="leading-none">Kalender</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Mobil: prickar för att växla mellan intervjuerna, en per yta. */}
              {liveInterviews.length > 1 && (
                <div className="mt-1.5 flex items-center justify-center gap-1.5 sm:hidden">
                  {liveInterviews.map((interview, index) => (
                    <button
                      key={interview.id}
                      type="button"
                      aria-label={`Visa intervju ${index + 1}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMobileIndex(index);
                      }}
                      className="flex h-4 w-4 items-center justify-center"
                    >
                      <span
                        className={cn(
                          'block h-1.5 w-1.5 rounded-full transition-colors',
                          index === activeIndex ? 'bg-white' : 'bg-white/40',
                        )}
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

      </CardContent>
    </Card>
  );
});

EmployerInterviewsCard.displayName = 'EmployerInterviewsCard';
