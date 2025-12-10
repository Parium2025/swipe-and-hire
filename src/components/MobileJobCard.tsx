import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Eye, Users, MapPin, Calendar, Edit, Trash2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import type { JobPosting } from '@/hooks/useJobsData';
import { formatDateShortSv } from '@/lib/date';

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

export const MobileJobCard = memo(({ job, onToggleStatus, onEdit, onDelete, onEditDraft }: MobileJobCardProps) => {
  const navigate = useNavigate();
  const jobIsComplete = isJobComplete(job);

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
          <div className="flex items-center gap-1.5">
            {!job.is_active && !jobIsComplete && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info size={14} className="text-amber-400 cursor-help" onClick={(e) => e.stopPropagation()} />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs bg-slate-900/95 border-white/20 text-white">
                    <p className="text-xs font-medium mb-1">Saknade fält:</p>
                    <p className="text-xs text-white/80">{getMissingFields(job).join(', ')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Switch
              checked={job.is_active}
              onCheckedChange={() => onToggleStatus(job.id, job.is_active, job)}
              onClick={(e) => e.stopPropagation()}
              disabled={!job.is_active && !jobIsComplete}
              className={`flex-shrink-0 ${!job.is_active && !jobIsComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-start gap-0.5">
          <Badge
            variant={job.is_active ? "default" : "secondary"}
            className={`text-xs ${job.is_active ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}
          >
            {job.is_active ? 'Aktiv' : 'Utkast'}
          </Badge>
          {!job.is_active && (
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
        <div className="flex items-center gap-1 text-xs text-white">
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

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <Button 
            variant="outlineNeutral" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(job);
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
