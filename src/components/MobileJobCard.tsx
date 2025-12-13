import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Eye, Users, MapPin, Calendar, Edit, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import type { JobPosting } from '@/hooks/useJobsData';
import { formatDateShortSv, isJobExpiredCheck, getTimeRemaining, formatExpirationDateTime } from '@/lib/date';

interface MobileJobCardProps {
  job: JobPosting;
  onToggleStatus: (jobId: string, currentStatus: boolean, job: JobPosting) => void;
  onEdit: (job: JobPosting) => void;
  onDelete: (job: JobPosting) => void;
  onEditDraft?: (job: JobPosting) => void;
}

// Validate if a job has all required fields to be activated
const isJobComplete = (job: JobPosting): boolean => {
  const requiredFields = [
    job.title,
    job.description,
    (job as any).salary_type,
    (job as any).salary_transparency,
    (job as any).work_start_time,
    (job as any).work_end_time,
    (job as any).positions_count,
    job.location || (job as any).workplace_city,
  ];
  
  return requiredFields.every(field => field !== null && field !== undefined && field !== '');
};

// Get missing fields for tooltip
const getMissingFields = (job: JobPosting): string[] => {
  const missing: string[] = [];
  if (!job.title) missing.push('Jobbtitel');
  if (!job.description) missing.push('Jobbeskrivning');
  if (!(job as any).salary_type) missing.push('Lönetyp');
  if (!(job as any).salary_transparency) missing.push('Lönetransparens');
  if (!(job as any).work_start_time || !(job as any).work_end_time) missing.push('Arbetstider');
  if (!(job as any).positions_count) missing.push('Antal tjänster');
  if (!job.location && !(job as any).workplace_city) missing.push('Plats');
  return missing;
};

// Check if job has expired (using effective expiration date)
const isJobExpired = (job: JobPosting): boolean => {
  return isJobExpiredCheck(job.created_at, job.expires_at);
};

export const MobileJobCard = memo(({ job, onToggleStatus, onEdit, onDelete, onEditDraft }: MobileJobCardProps) => {
  const navigate = useNavigate();
  const jobIsComplete = isJobComplete(job);
  const jobIsExpired = isJobExpired(job);

  const handleCardClick = () => {
    // If job is inactive (draft) and onEditDraft is provided, open wizard instead
    if (!job.is_active && onEditDraft) {
      onEditDraft(job);
    } else {
      navigate(`/job-details/${job.id}`);
    }
  };

  return (
    <Card 
      className="bg-transparent touch-border-white shadow-none min-h-[120px] cursor-pointer transition-all duration-150 hover:bg-white/5 hover:border-white/50 active:scale-[0.98] active:bg-white/10"
      onClick={handleCardClick}
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
                variant="secondary" 
                className="mt-1 text-xs bg-white/10 text-white border-white/20"
              >
                {getEmploymentTypeLabel(job.employment_type)}
              </Badge>
            )}
          </div>
          {/* Expired job - red switch with tooltip */}
          {jobIsExpired ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={false}
                      disabled
                      className="flex-shrink-0 cursor-pointer [&>span]:bg-red-500 opacity-100"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs bg-slate-900/95 border-white/20 text-white">
                  <p className="text-xs font-medium mb-1 text-red-400">Annonsens tid har gått ut</p>
                  <p className="text-xs text-white/80">Dina 14 dagar har passerat. Skapa en ny annons från dina mallar.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : !job.is_active && !jobIsComplete ? (
            /* Incomplete draft - amber switch with tooltip */
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={job.is_active}
                      disabled
                      className="flex-shrink-0 cursor-pointer [&>span]:bg-amber-500 opacity-100"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs bg-slate-900/95 border-white/20 text-white">
                  <p className="text-xs font-medium mb-1">Saknade fält:</p>
                  <p className="text-xs text-white/80">{getMissingFields(job).join(', ')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            /* Normal switch */
            <Switch
              checked={job.is_active}
              onCheckedChange={() => onToggleStatus(job.id, job.is_active, job)}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0"
            />
          )}
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-start gap-0.5">
          <Badge
            variant={job.is_active ? "default" : "secondary"}
            className={`text-xs ${
              jobIsExpired 
                ? "bg-red-500/20 text-red-300 border-red-500/30"
                : job.is_active 
                  ? "bg-green-500/20 text-green-300 border-green-500/30" 
                  : "bg-amber-500/20 text-amber-300 border-amber-500/30"
            }`}
          >
            {jobIsExpired ? 'Utgången' : job.is_active ? 'Aktiv' : 'Utkast'}
          </Badge>
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
                    <span className={`text-[10px] cursor-pointer ${timeInfo.isExpired ? 'text-red-400' : 'text-white'}`}>
                      {timeInfo.isExpired ? 'Utgången' : `Utgår: ${timeInfo.text}`}
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

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <Button 
            variant="outlineNeutral" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // For drafts, use onEditDraft to open the wizard
              if (!job.is_active && onEditDraft) {
                onEditDraft(job);
              } else {
                onEdit(job);
              }
            }}
            className="flex-1 h-11 bg-transparent border-white/20 text-white !hover:bg-blue-500/20 !hover:border-blue-500/40 hover:!text-white text-sm"
          >
            <Edit className="h-4 w-4 mr-2" />
            Redigera
          </Button>
          <Button 
            variant="outlineNeutral" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(job);
            }}
            className="flex-1 h-11 bg-transparent border-white/20 text-white !hover:bg-red-500/20 !hover:border-red-500/40 hover:!text-white text-sm"
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
