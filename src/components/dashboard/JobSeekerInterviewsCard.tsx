import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Video, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCandidateInterviews } from '@/hooks/useInterviews';
import { format, isToday, isTomorrow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { GRADIENTS } from './dashboardConstants';

type LocationType = 'video' | 'office';

const formatInterviewDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Idag';
  if (isTomorrow(date)) return 'Imorgon';
  return format(date, 'd MMM', { locale: sv });
};

const formatInterviewTime = (dateStr: string): string => {
  return format(new Date(dateStr), 'HH:mm');
};

const getTimeUntil = (scheduledAt: string): string => {
  const now = new Date();
  const scheduled = new Date(scheduledAt);
  const diffMs = scheduled.getTime() - now.getTime();
  
  if (diffMs < 0) return 'Pågår/passerad';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 60) return `Om ${diffMins} min`;
  if (diffHours < 24) return `Om ${diffHours} tim`;
  if (diffDays === 1) return 'Imorgon';
  if (diffDays < 7) return `Om ${diffDays} dagar`;
  return formatInterviewDate(scheduledAt);
};

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
  
  const upcomingInterviews = interviews.slice(0, 5);
  const hasMore = interviews.length > 5;

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.interviews} border-0 shadow-lg dashboard-card-height`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
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
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-3 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 rounded-xl bg-white/10">
            <Calendar className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">INTERVJUER</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {upcomingInterviews.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Calendar className="h-8 w-8 text-white mb-2" />
              <p className="text-sm font-medium text-white">Inga bokade intervjuer</p>
              <p className="text-xs text-white mt-1">Fortsätt söka jobb!</p>
            </div>
          ) : (
            <div className="space-y-1.5 overflow-y-auto h-full pr-1 scrollbar-hide">
              {upcomingInterviews.map((interview: any) => {
                const LocationIcon = getLocationIcon(interview.location_type);
                const timeUntil = getTimeUntil(interview.scheduled_at);
                const isUrgent = timeUntil.includes('min') || timeUntil.includes('tim');
                
                const employerProfile = interview.job_postings?.profiles ?? (interview as any).profiles;
                const companyName = employerProfile?.company_name ||
                  `${employerProfile?.first_name || ''} ${employerProfile?.last_name || ''}`.trim() ||
                  'Okänt företag';
                
                return (
                  <motion.div
                    key={interview.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/10 rounded-lg p-2 cursor-pointer hover:bg-white/15 transition-colors"
                    onClick={() => {
                      if (interview.location_type === 'video' && interview.location_details) {
                        window.open(interview.location_details, '_blank', 'noopener');
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
            className="text-[10px] text-white/80 hover:text-white underline underline-offset-2 mt-1 text-center"
          >
            Se alla ({interviews.length})
          </button>
        )}
      </CardContent>
    </Card>
  );
});

JobSeekerInterviewsCard.displayName = 'JobSeekerInterviewsCard';
