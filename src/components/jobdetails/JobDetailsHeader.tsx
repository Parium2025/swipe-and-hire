/**
 * Job header section for JobDetails page.
 * Shows title, location, status badge, stats, and action buttons.
 * Extracted for modularity — zero visual changes.
 */
import { memo, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X,
  Eye,
  Users,
  MapPin,
  Plus,
  CheckSquare,
} from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import JobQrCodeButton from '@/components/JobQrCode';
import { JobStatusBadge } from './JobStatusBadge';
import { CreateJobStageDialog } from '@/components/CreateJobStageDialog';

interface JobDetailsHeaderProps {
  jobId: string;
  job: {
    title: string;
    location: string | null;
    is_active: boolean | null;
    expires_at: string | null;
    views_count: number | null;
    applications_count: number | null;
    employer_profile?: {
      first_name: string | null;
      last_name: string | null;
      profile_image_url: string | null;
    } | null;
  };
  employerProfileImageUrl: string | null;
  applicationsCount: number;
  activeStagesLength: number;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  onExitSelectionMode: () => void;
  onUpdateJobLocally: (updates: Record<string, unknown>) => void;
}

export const JobDetailsHeader = memo(function JobDetailsHeader({
  jobId,
  job,
  employerProfileImageUrl,
  applicationsCount,
  activeStagesLength,
  isSelectionMode,
  onToggleSelectionMode,
  onExitSelectionMode,
  onUpdateJobLocally,
}: JobDetailsHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [recruiterTooltipOpen, setRecruiterTooltipOpen] = useState(false);
  const recruiterTooltipRef = useRef<HTMLDivElement>(null);

  // Close recruiter tooltip on outside tap (touch devices)
  useEffect(() => {
    if (!recruiterTooltipOpen) return;
    const handler = (e: PointerEvent) => {
      if (recruiterTooltipRef.current && !recruiterTooltipRef.current.contains(e.target as Node)) {
        setRecruiterTooltipOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [recruiterTooltipOpen]);

  return (
    <div className="relative z-30 rounded-lg border border-white/20 bg-white/5 p-3 backdrop-blur-sm md:p-4">
      <div className="flex items-start justify-between gap-2">
        <TruncatedText 
          text={job.title} 
          className="text-lg font-bold text-white flex-1 min-w-0 line-clamp-2"
        />
        <button
          onClick={() => {
            const navState = (location.state as { fromRoute?: '/dashboard' | '/my-jobs'; fromTab?: 'active' | 'expired' | 'draft' } | null) ?? null;
            if (navState?.fromRoute) {
              const tabSuffix = navState.fromTab && navState.fromTab !== 'active' ? `?tab=${navState.fromTab}` : '';
              navigate(`${navState.fromRoute}${tabSuffix}`, { replace: true });
            } else if (window.history.state?.idx > 0) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="relative z-50 flex h-7 w-7 !min-h-0 !min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-white transition-colors touch-manipulation active:scale-95 focus:outline-none md:hover:bg-white/20"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm">
        <div className="flex items-center gap-1 text-white">
          <MapPin className="h-3.5 w-3.5" />
          {job.location}
        </div>
        <JobStatusBadge
          jobId={jobId}
          isActive={!!job.is_active}
          expiresAt={job.expires_at}
          onOptimisticUpdate={onUpdateJobLocally}
        />
        {job.expires_at && (
          <span className="text-white text-xs">
            {new Date(job.expires_at) < new Date() 
              ? `Gick ut ${new Date(job.expires_at).toLocaleDateString('sv-SE')}`
              : `Går ut ${new Date(job.expires_at).toLocaleDateString('sv-SE')}`
            }
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1.5 md:space-y-0">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 min-w-0">
          <div className="flex min-w-0 items-center justify-center gap-1 overflow-hidden rounded-lg border border-white/20 bg-white/5 px-2 py-1.5">
            <Eye className="h-3.5 w-3.5 text-white flex-shrink-0" />
            <span className="text-white text-xs font-medium truncate">{job.views_count}</span>
            <span className="text-white text-xs truncate">Visn.</span>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-1 overflow-hidden rounded-lg border border-white/20 bg-white/5 px-2 py-1.5">
            <Users className="h-3.5 w-3.5 text-white flex-shrink-0" />
            <span className="text-white text-xs font-medium truncate">{job.applications_count}</span>
            <span className="text-white text-xs truncate">Ans.</span>
          </div>

          {job.employer_profile ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip open={recruiterTooltipOpen} onOpenChange={setRecruiterTooltipOpen}>
                <TooltipTrigger asChild>
                  <div 
                    ref={recruiterTooltipRef}
                    className="flex min-w-0 cursor-default items-center justify-center gap-1 overflow-hidden rounded-lg border border-white/20 bg-white/5 px-2 py-1.5"
                    onClick={() => setRecruiterTooltipOpen(prev => !prev)}
                  >
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary/60 to-primary overflow-hidden flex items-center justify-center text-[10px] text-white font-medium shrink-0">
                      {employerProfileImageUrl ? (
                        <img src={employerProfileImageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        `${job.employer_profile.first_name?.[0] || ''}${job.employer_profile.last_name?.[0] || ''}`
                      )}
                    </div>
                    <span className="text-white text-xs truncate max-w-[60px]">
                      {job.employer_profile.first_name}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Rekryterare: {job.employer_profile.first_name} {job.employer_profile.last_name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="min-w-0 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5" />
          )}

          <button
            onClick={() => applicationsCount > 0 ? (isSelectionMode ? onExitSelectionMode() : onToggleSelectionMode()) : undefined}
            onMouseDown={(e) => e.preventDefault()}
            className={`hidden md:flex rounded-lg px-2 py-1.5 items-center justify-center gap-1 outline-none focus:outline-none transition-all duration-200 min-w-0 overflow-hidden ${
              isSelectionMode 
                ? 'bg-white/10 ring-1 ring-white hover:bg-white/15' 
                : applicationsCount > 0 
                  ? 'border border-white/20 bg-white/5 hover:bg-white/10' 
                  : 'border border-white/20 bg-white/5 opacity-40 cursor-default'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5 text-white flex-shrink-0" />
            <span className="text-white text-xs font-medium">{isSelectionMode ? 'Avbryt' : 'Välj'}</span>
          </button>
          <div className="hidden md:flex min-w-0">
            <JobQrCodeButton jobId={jobId} jobTitle={job.title} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 min-w-0 md:hidden">
          <button
            onClick={() => applicationsCount > 0 ? (isSelectionMode ? onExitSelectionMode() : onToggleSelectionMode()) : undefined}
            onMouseDown={(e) => e.preventDefault()}
            className={`rounded-lg px-2 py-1.5 flex items-center justify-center gap-1 outline-none focus:outline-none transition-all duration-200 ring-1 min-w-0 overflow-hidden ${
              isSelectionMode 
                ? 'bg-white/[0.08] ring-white/70' 
                : applicationsCount > 0 
                  ? 'bg-white/[0.045] ring-white/30' 
                  : 'bg-white/[0.04] ring-white/20 opacity-40 cursor-default'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5 text-white flex-shrink-0" />
            <span className="text-white text-xs font-medium">Välj</span>
          </button>

          <JobQrCodeButton jobId={jobId} jobTitle={job.title} />
        </div>
      </div>
    </div>
  );
});
