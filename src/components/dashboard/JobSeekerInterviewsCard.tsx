import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Video, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCandidateInterviews } from '@/hooks/useInterviews';
import { useMinuteTick } from '@/hooks/useMinuteTick';
import {
  formatInterviewDate,
  formatInterviewTime,
  getTimeUntil,
  isInterviewUrgent,
  isInterviewOver,
  getMeetingUrl,
} from '@/lib/interviewTime';
import { GRADIENTS } from './dashboardConstants';

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
  const { interviews, isLoading } = useCandidateInterviews();
  const navigate = useNavigate();
  const now = useMinuteTick();

  const liveInterviews = useMemo(
    () => (interviews as any[]).filter((i) => !isInterviewOver(i.scheduled_at, i.duration_minutes, now)),
    [interviews, now],
  );
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
          {upcomingInterviews.length === 0 ? (
            <div
              className="flex-1 flex flex-col items-center justify-center text-center transform-gpu"
              style={{ backfaceVisibility: 'hidden', WebkitFontSmoothing: 'antialiased' }}
            >
              <Calendar className="h-8 w-8 text-white mb-2" />
              <p className="text-sm font-medium text-white">Inga bokade intervjuer</p>
              <p className="text-xs text-white mt-1">Fortsätt söka jobb!</p>
            </div>
          ) : (
            <div className="space-y-1.5 overflow-y-auto h-full pr-1 scrollbar-hide">
              {upcomingInterviews.map((interview: any) => {
                const LocationIcon = getLocationIcon(interview.location_type);
                const timeUntil = getTimeUntil(interview.scheduled_at, now);
                const isUrgent = isInterviewUrgent(interview.scheduled_at, now);
                const meetingUrl = getMeetingUrl(interview.location_details);
                
                const companyName = interview.job_postings?.workplace_name?.trim() || 'Okänt företag';
                
                return (
                  <motion.div
                    key={interview.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/10 rounded-lg p-2 cursor-pointer hover:bg-white/15 transition-colors"
                    onClick={() => {
                      if (interview.location_type === 'video' && meetingUrl) {
                        window.open(meetingUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        navigate('/my-applications');
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {interview.job_postings?.title || 'Intervju'}
                        </p>
                        <p className="text-[10px] text-white truncate">
                          {companyName}
                        </p>
                      </div>
                      
                      <span className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap text-white",
                        isUrgent && "bg-white/20"
                      )}>
                        {timeUntil}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-white">
                      <span>{formatInterviewDate(interview.scheduled_at)}</span>
                      <span>kl {formatInterviewTime(interview.scheduled_at)}</span>
                      <span className="flex items-center gap-0.5">
                        <LocationIcon className="h-2.5 w-2.5" />
                        {getLocationLabel(interview.location_type)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        
        {hasMore && (
          <button
            onClick={() => navigate('/my-applications')}
            className="text-[10px] text-white hover:text-white underline underline-offset-2 mt-1 text-center"
          >
            Se alla ({liveInterviews.length})
          </button>
        )}
      </CardContent>
    </Card>
  );
});

JobSeekerInterviewsCard.displayName = 'JobSeekerInterviewsCard';
