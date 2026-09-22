import { memo, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CalendarPlus, Video, Building2, CheckCircle2, Clock3, XCircle } from 'lucide-react';
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
  const { interviews, isLoading, error } = useInterviews();
  const navigate = useNavigate();
  const now = useMinuteTick();
  // Dubbeltryck (vanligt på mobil) ska inte öppna två mötesflikar.
  const lastOpenRef = useRef(0);

  // Avslutade och avböjta möten ligger kvar (hämtningen släpper dem efter ett
  // dygn) så att ingen kandidat glöms bort — men de sorteras efter de aktiva.
  const liveInterviews = useMemo(() => {
    const isDone = (i: Interview) =>
      i.status === 'declined' || isInterviewOver(i.scheduled_at, i.duration_minutes, now);
    return [...interviews].sort((a, b) => {
      const aDone = isDone(a) ? 1 : 0;
      const bDone = isDone(b) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    });
  }, [interviews, now]);
  const upcomingInterviews = liveInterviews.slice(0, 5);
  const hasMore = liveInterviews.length > 5;

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
    <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.interviews} border-0 shadow-lg dashboard-card-height`}>
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
          {upcomingInterviews.length === 0 ? (
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
            <div className="space-y-1.5 overflow-y-auto h-full pr-1 scrollbar-hide">
              {upcomingInterviews.map((interview) => {
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
                const isUrgent = !canDismiss && isInterviewUrgent(interview.scheduled_at, now);
                const meetingUrl = getMeetingUrl(interview.location_details);

                return (
                  <motion.div
                    key={interview.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      'rounded-lg p-2 cursor-pointer transition-colors',
                      canDismiss ? 'bg-white/5 hover:bg-white/10' : 'bg-white/10 hover:bg-white/15',
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
                        <TruncatedText text={interview.candidate_name} className="text-xs font-semibold text-white" insideInteractive />
                        <TruncatedText text={interview.job_title} className="text-[10px] text-white" insideInteractive />
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap text-white",
                          isUrgent && "bg-white/20"
                        )}>
                          {timeUntil}
                        </span>
                        <span className="flex w-[76px] items-center justify-start gap-1 rounded px-1 py-0.5 whitespace-nowrap text-[9px] font-medium leading-none text-white">
                          {isDeclined ? (
                            <XCircle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          ) : interview.status === 'confirmed' ? (
                            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <Clock3 className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          )}
                          {isDeclined
                            ? 'Avböjt'
                            : interview.status === 'confirmed'
                              ? 'Bekräftad'
                              : 'Inväntar svar'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] leading-none text-white whitespace-nowrap">
                      <span className="leading-none">{formatInterviewDate(interview.scheduled_at)}</span>
                      <span className="leading-none">kl {formatInterviewTimeWithZone(interview.scheduled_at)}</span>
                      <span className="flex items-center gap-1 leading-none">
                        <LocationIcon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                        <span className="leading-none">{getLocationLabel(interview.location_type)}</span>
                      </span>
                      {canDismiss ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            dismissInterview.mutate(interview.id);
                          }}
                          className="ml-auto flex w-[76px] items-center justify-start gap-1 rounded px-1 py-0.5 leading-none text-white hover:bg-white/15"
                          aria-label="Ta bort från översikten"
                        >
                          <Trash2 className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          <span className="leading-none">Ta bort</span>
                        </button>
                      ) : (
                        /* Fungerar även utan kopplad kalender: filen läggs in i
                           Google, Outlook eller Apple med samma id, så inget dubbleras. */
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            window.open(
                              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-interview-ics?id=${interview.id}`,
                              '_blank',
                              'noopener,noreferrer',
                            );
                          }}
                          className="ml-auto flex w-[76px] items-center justify-start gap-1 rounded px-1 py-0.5 leading-none text-white hover:bg-white/15"
                          aria-label="Lägg till i kalender"
                        >
                          <CalendarPlus className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          <span className="leading-none">Kalender</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {hasMore && (
          <button
            onClick={() => navigate('/my-candidates')}
            className="text-[10px] text-white hover:text-white underline underline-offset-2 mt-1 text-center"
          >
            Se alla ({liveInterviews.length})
          </button>
        )}
      </CardContent>
    </Card>
  );
});

EmployerInterviewsCard.displayName = 'EmployerInterviewsCard';
