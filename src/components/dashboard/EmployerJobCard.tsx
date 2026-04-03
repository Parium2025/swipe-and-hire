import { memo, useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, MapPin, Calendar, Timer, UserCheck, Building2 } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { formatDateShortSv, getTimeRemaining, isJobExpiredCheck, formatExpirationDateTime } from '@/lib/date';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { imageCache } from '@/lib/imageCache';

interface EmployerJobCardProps {
  job: {
    id: string;
    title: string;
    location: string;
    employment_type?: string;
    is_active: boolean;
    views_count: number;
    applications_count: number;
    created_at: string;
    expires_at?: string;
    job_image_url?: string;
    image_focus_position?: string;
    employer_profile?: {
      first_name: string;
      last_name: string;
      company_name: string | null;
    };
  };
  activeTab: 'active' | 'expired';
  onClick: (jobId: string) => void;
}

const GRADIENTS = [
  'from-blue-900/40 via-indigo-900/30 to-slate-900/50',
  'from-indigo-900/40 via-blue-900/30 to-slate-900/50',
  'from-sky-900/40 via-blue-900/30 to-slate-900/50',
  'from-blue-900/40 via-sky-900/30 to-slate-900/50',
  'from-indigo-900/40 via-slate-900/30 to-blue-900/50',
  'from-cyan-900/40 via-blue-900/30 to-slate-900/50',
];

function getGradientForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function getCompanyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    const w = words[0];
    return (w[0] + w[w.length - 1]).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export const EmployerJobCard = memo(({ job, activeTab, onClick }: EmployerJobCardProps) => {
  const isExpired = isJobExpiredCheck(job.created_at, job.expires_at);
  const timeInfo = getTimeRemaining(job.created_at, job.expires_at);
  const companyName = job.employer_profile?.company_name || 'Okänt företag';
  const recruiterName = job.employer_profile?.first_name && job.employer_profile?.last_name
    ? `${job.employer_profile.first_name} ${job.employer_profile.last_name}`
    : null;

  // Image resolution (same pattern as ReadOnlyMobileJobCard)
  const resolvedUrl = useMemo(() => {
    if (!job.job_image_url) return null;
    if (job.job_image_url.startsWith('http')) return job.job_image_url;
    const { data } = supabase.storage.from('job-images').getPublicUrl(job.job_image_url);
    return data?.publicUrl || null;
  }, [job.job_image_url]);

  const cachedBlobUrl = useMemo(() => {
    if (!resolvedUrl) return null;
    return imageCache.getCachedUrl(resolvedUrl);
  }, [resolvedUrl]);

  const [loadedBlobUrl, setLoadedBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!resolvedUrl || cachedBlobUrl) { setLoadedBlobUrl(null); return; }
    let cancelled = false;
    imageCache.loadImage(resolvedUrl)
      .then(blobUrl => { if (!cancelled) setLoadedBlobUrl(blobUrl); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [resolvedUrl, cachedBlobUrl]);

  const displayUrl = cachedBlobUrl || loadedBlobUrl || resolvedUrl;
  const gradient = useMemo(() => getGradientForId(job.id), [job.id]);
  const initials = useMemo(() => getCompanyInitials(companyName), [companyName]);

  return (
    <Card
      className="job-card-mobile-shell group bg-white/5 border-white/20 overflow-hidden cursor-pointer transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] hover:bg-white/10 hover:border-white/30"
      onClick={() => onClick(job.id)}
    >
      {/* Image header */}
      <div className="job-card-mobile-media relative w-full overflow-hidden">
        {displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt={job.title}
              className="w-full h-full object-cover"
              style={{ objectPosition: `center ${(() => {
                const v = job.image_focus_position;
                if (!v || v === 'center') return '50%';
                if (v === 'top') return '20%';
                if (v === 'bottom') return '80%';
                return `${v}%`;
              })()}` }}
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 pb-6`}>
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <span className="text-xl font-bold text-white/50 tracking-wide">{initials}</span>
            </div>
          </div>
        )}

        {/* Status badge — top-left */}
        <div className="absolute top-2.5 left-2.5">
          {isExpired ? (
            <Badge variant="glassDestructive" className="text-[11px] px-2 py-0.5">
              Utgången
            </Badge>
          ) : job.is_active ? (
            <Badge className="bg-green-500/90 text-white border-0 text-[11px] px-2 py-0.5">
              Aktiv
            </Badge>
          ) : (
            <Badge className="bg-amber-500/90 text-white border-0 text-[11px] px-2 py-0.5">
              Utkast
            </Badge>
          )}
        </div>

        {/* Views badge — top-right */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/15">
          <Eye className="h-3.5 w-3.5 text-white" />
          <span className="text-xs font-medium text-white">{job.views_count || 0}</span>
        </div>
      </div>

      {/* Content body */}
      <div className="job-card-mobile-body space-y-2">
        {/* Title */}
        <TruncatedText
          text={job.title}
          className="text-base font-bold text-white leading-snug line-clamp-2 text-center"
        />

        {/* Info badges row */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {job.employment_type && (
            <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none">
              {getEmploymentTypeLabel(job.employment_type)}
            </Badge>
          )}
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center">
            <Users className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="leading-none">{job.applications_count || 0} ansökningar</span>
          </Badge>
        </div>

        {/* Location */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center max-w-[90%] overflow-hidden">
            <MapPin className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="leading-none truncate">{job.location}</span>
          </Badge>
        </div>

        {/* Recruiter */}
        {recruiterName && (
          <div className="flex items-center justify-center gap-1.5">
            <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center max-w-[90%] overflow-hidden">
              <UserCheck className="h-3 w-3 mr-0.5 flex-shrink-0" />
              <span className="leading-none truncate">{recruiterName}</span>
            </Badge>
          </div>
        )}

        {/* Created date + expiration */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center">
            <Calendar className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="leading-none">{formatDateShortSv(job.created_at)}</span>
          </Badge>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="glass" 
                  className={`text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center cursor-pointer ${
                    isExpired ? 'bg-red-500/20 text-red-300 border-red-500/30' : ''
                  }`}
                >
                  <Timer className="h-3 w-3 mr-0.5 flex-shrink-0" />
                  <span className="leading-none">{isExpired ? 'Utgången' : `${timeInfo.text} kvar`}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-900/95 border-white/20 text-white">
                <p className="text-xs">{formatExpirationDateTime(job.created_at, job.expires_at)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Card>
  );
});

EmployerJobCard.displayName = 'EmployerJobCard';
