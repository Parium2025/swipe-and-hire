import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Users, MapPin, Calendar, Edit, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import type { JobPosting } from '@/hooks/useJobsData';
import { formatDateShortSv, isJobExpiredCheck, getTimeRemaining, formatExpirationDateTime } from '@/lib/date';

interface MobileJobCardProps {
  job: JobPosting;
  onEdit: (job: JobPosting) => void;
  onDelete: (job: JobPosting) => void;
  onEditDraft?: (job: JobPosting) => void;
  onPrefetch?: (jobId: string) => void;
}

// Check if job has expired (using effective expiration date)
const isJobExpired = (job: JobPosting): boolean => {
  return isJobExpiredCheck(job.created_at, job.expires_at);
};

export const MobileJobCard = memo(({ job, onEdit, onDelete, onEditDraft, onPrefetch }: MobileJobCardProps) => {
  const navigate = useNavigate();
  const jobIsExpired = isJobExpired(job);

  const handleCardClick = () => {
    // If job is inactive (draft) and onEditDraft is provided, open wizard instead
    if (!job.is_active && onEditDraft) {
      onEditDraft(job);
    } else {
      navigate(`/job-details/${job.id}`);
    }
  };

  // Prefetch on touch start for mobile (before click)
  const handleTouchStart = () => {
    if (job.is_active && onPrefetch) {
      onPrefetch(job.id);
    }
  };

  const isDraft = !job.is_active;

  return (
    <Card 
      className={`group bg-transparent touch-border-white shadow-none min-h-[120px] cursor-pointer transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] ${
        jobIsExpired 
          ? "hover:bg-red-500/10 hover:border-red-500/30 active:bg-red-500/15" 
          : isDraft 
            ? "hover:bg-amber-500/10 hover:border-amber-500/30 active:bg-amber-500/15"
            : "hover:bg-white/5 hover:border-white/50 active:bg-white/10"
      }`}
      style={{ contain: 'layout style paint', contentVisibility: 'auto', containIntrinsicSize: 'auto 180px' } as React.CSSProperties}
      onClick={handleCardClick}
      onTouchStart={handleTouchStart}
    >
      <div className="p-3 space-y-2">
        {/* Titel + Switch */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
              {job.title}
            </h3>
            {job.employment_type && (
              <Badge 
                variant="glass" 
                className="mt-1 text-xs"
              >
                {getEmploymentTypeLabel(job.employment_type)}
              </Badge>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-start gap-0.5">
          {jobIsExpired ? (
            <Badge variant="glassDestructive" className="px-3 text-xs">
              Utgången
            </Badge>
          ) : job.is_active ? (
            <Badge variant="glass" className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
              Aktiv
            </Badge>
          ) : (
            <Badge variant="glass" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
              Utkast
            </Badge>
          )}
          {jobIsExpired && (
            <span className="text-[10px] text-red-300/70">Skapa ny annons</span>
          )}
          {!job.is_active && !jobIsExpired && (
            <span className="text-[10px] text-amber-300/70">Tryck för att redigera</span>
          )}
        </div>

        {/* Stats + Plats */}
        <div className="flex items-center gap-3 text-xs text-white">
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            <span>{job.views_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{job.applications_count || 0}</span>
          </div>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
        </div>

        {/* Rekryterare + Datum */}
        <div className="flex flex-col gap-0.5 text-xs text-white">
          <div className="flex items-center gap-1">
            <span>
              {job.employer_profile?.first_name && job.employer_profile?.last_name && (
                <>
                  {job.employer_profile.first_name} {job.employer_profile.last_name} • {' '}
                </>
              )}
            </span>
            <Calendar className="h-3 w-3" />
            <span>
              Skapad: {formatDateShortSv(job.created_at)}
            </span>
          </div>
          {(() => {
            const timeInfo = getTimeRemaining(job.created_at, job.expires_at);
            return (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`text-xs cursor-pointer ${timeInfo.isExpired ? 'text-red-400' : 'text-white'}`}>
                      {timeInfo.isExpired ? 'Utgången' : `Utgår om: ${timeInfo.text}`}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-slate-900/95 border-white/20 text-white">
                    <p className="text-xs">{formatExpirationDateTime(job.created_at, job.expires_at)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })()}
        </div>

        {/* Action Buttons - Hide edit button for expired jobs */}
        <div className="flex gap-2 pt-1">
          {!jobIsExpired && (
            <Button 
              variant="glass" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (!job.is_active && onEditDraft) {
                  onEditDraft(job);
                } else {
                  onEdit(job);
                }
              }}
              className="flex-1 h-11 text-sm transition-[background-color,border-color] duration-150 hover:bg-blue-500/20 hover:border-blue-500/40"
            >
              <Edit className="h-4 w-4 mr-2" />
              Redigera
            </Button>
          )}
          <Button 
            variant="glass" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(job);
            }}
            className={`${jobIsExpired ? 'w-full' : 'flex-1'} h-11 text-sm transition-[background-color,border-color] duration-150 hover:bg-red-500/20 hover:border-red-500/40`}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Ta bort
          </Button>
        </div>
      </div>
    </Card>
  );
});

MobileJobCard.displayName = 'MobileJobCard';
