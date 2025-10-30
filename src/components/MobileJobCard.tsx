import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Eye, Users, MapPin, Calendar, Edit, Trash2 } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import type { JobPosting } from '@/hooks/useJobsData';
import { formatDateShortSv } from '@/lib/date';

interface MobileJobCardProps {
  job: JobPosting;
  onToggleStatus: (jobId: string, currentStatus: boolean) => void;
  onEdit: (job: JobPosting) => void;
  onDelete: (job: JobPosting) => void;
}

export const MobileJobCard = memo(({ job, onToggleStatus, onEdit, onDelete }: MobileJobCardProps) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/job-details/${job.id}`);
  };

  return (
    <Card 
      className="bg-transparent touch-border-white shadow-none min-h-[120px] cursor-pointer transition-all duration-150 hover:bg-white/5 active:scale-[0.98] active:bg-white/10"
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
          <Switch
            checked={job.is_active}
            onCheckedChange={() => onToggleStatus(job.id, job.is_active)}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          />
        </div>

        {/* Status Badge */}
        <div>
          <Badge
            variant={job.is_active ? "default" : "secondary"}
            className={`text-xs ${job.is_active ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
          >
            {job.is_active ? 'Aktiv' : 'Inaktiv'}
          </Badge>
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
