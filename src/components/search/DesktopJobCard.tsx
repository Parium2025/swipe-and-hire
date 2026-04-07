import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Briefcase, Calendar, Building2, Users, Timer, CheckCircle, Heart } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { formatDateShortSv, getTimeRemaining } from '@/lib/date';

interface DesktopJobCardProps {
  job: {
    id: string;
    title: string;
    company_name: string;
    location: string;
    employment_type: string;
    created_at: string;
    expires_at?: string;
    applications_count: number;
    employer_id?: string;
  };
  hasApplied: boolean;
  isJobSaved: boolean;
  onToggleSave: (jobId: string) => void;
  onOpenCompanyProfile: (employerId: string) => void;
}

export const DesktopJobCard = memo(function DesktopJobCard({
  job,
  hasApplied,
  isJobSaved,
  onToggleSave,
  onOpenCompanyProfile,
}: DesktopJobCardProps) {
  const navigate = useNavigate();
  const { text: timeText, isExpired } = getTimeRemaining(job.created_at, job.expires_at);

  return (
    <Card
      data-scroll-anchor-id={job.id}
      onClick={() => navigate(`/job-view/${job.id}`)}
      className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 transition-all duration-300 cursor-pointer group"
    >
      <CardContent className="job-card-desktop-body p-5 relative">
        {hasApplied && (
          <Badge variant="glass" className="absolute top-3 right-3 bg-green-500/20 text-green-300 border-green-500/30 text-xs px-2.5 py-1">
            <CheckCircle className="h-3 w-3 mr-1" />
            Redan sökt
          </Badge>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className={`flex-1 min-w-0 ${hasApplied ? 'max-w-[calc(100%-100px)]' : ''}`}>
            <TruncatedText
              text={job.title}
              className="text-lg font-semibold text-white truncate group-hover:text-white transition-colors block break-all"
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (job.employer_id) {
                  onOpenCompanyProfile(job.employer_id);
                }
              }}
              className="flex items-center gap-2 mt-1 text-white hover:text-white/80 transition-colors"
            >
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate underline-offset-2 hover:underline">
                {job.company_name || 'Okänt företag'}
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 text-sm text-white">
              {job.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{job.location}</span>
                </div>
              )}
              {job.employment_type && (
                <div className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDateShortSv(job.created_at)}</span>
              </div>
              <Badge variant="glass" className="text-xs px-2.5 py-1 transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50">
                <Users className="h-3 w-3 mr-1" />
                {job.applications_count || 0} sökande
              </Badge>
              {isExpired ? (
                <Badge variant="glass" className="bg-red-500/20 text-white border-red-500/30 text-xs px-2.5 py-1 transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-red-500/30 hover:border-red-500/50">
                  Utgången
                </Badge>
              ) : (
                <Badge variant="glass" className="text-xs px-2.5 py-1 transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50">
                  <Timer className="h-3 w-3 mr-1" />
                  {timeText} kvar
                </Badge>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(job.id);
                }}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all duration-300 ${
                  isJobSaved
                    ? 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50'
                    : 'bg-white/10 text-white border-white/25 hover:bg-white/15 hover:border-white/50'
                }`}
              >
                <Heart className={`h-3 w-3 ${isJobSaved ? 'fill-red-300' : ''}`} />
                {isJobSaved ? 'Sparad' : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
