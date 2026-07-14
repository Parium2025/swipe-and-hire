import { memo, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, Building2 } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { getEmploymentTypeLabel, formatEmploymentDetails } from '@/lib/employmentTypes';
import { formatDateShortSv, getTimeRemaining, formatExpirationDateTime } from '@/lib/date';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isEmployerJobExpired } from '@/lib/jobStatus';
import { useCardImage } from '@/hooks/useCardImage';
import { ResilientImage } from '@/components/ui/ResilientImage';
import { getJobBadgeSalary } from '@/lib/swipeJobSalary';

interface EmployerJobCardProps {
  job: {
    id: string;
    title: string;
    location: string;
    workplace_name?: string;
    employment_type?: string;
    part_time_days?: string[] | null;
    duration_amount?: number | null;
    duration_unit?: string | null;
    is_active: boolean;
    views_count: number;
    applications_count: number;
    created_at: string;
    expires_at?: string;
    overlay_text_color?: string | null;
    job_image_url?: string;
    company_logo_url?: string;
    image_focus_position?: string;
    salary_min?: number;
    salary_max?: number;
    salary_type?: string;
    salary_transparency?: string;
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
  const isExpired = isEmployerJobExpired(job);
  const timeInfo = getTimeRemaining(job.created_at, job.expires_at);
  const companyName = job.workplace_name?.trim() || 'Okänt företag';
  const recruiterName = job.employer_profile?.first_name && job.employer_profile?.last_name
    ? `${job.employer_profile.first_name} ${job.employer_profile.last_name}`
    : null;

  // Centraliserad bild-hantering — eliminerar 4 hooks per kort
  // 🚀 Transform: kortbild ~600x400 (5-10× mindre filer), logo ~64px
  const { displayUrl, handleError: handleImageError } = useCardImage(job.job_image_url, 'job-images', undefined, { width: 600, height: 400, quality: 75, resize: 'cover' });
  const { displayUrl: logoUrl, handleError: handleLogoError } = useCardImage(job.company_logo_url, 'company-logos', undefined, { width: 64, height: 64, quality: 80, resize: 'contain' });
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
            <ResilientImage
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
              loading="lazy"
              decoding="async"
              onError={handleImageError}
              fallbackClassName="w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 pb-6`}>
            {logoUrl ? (
              <>
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                  <ResilientImage src={logoUrl} alt={companyName} className="w-full h-full object-cover" draggable={false} onError={handleLogoError} fallbackClassName="w-full h-full" />
                </div>
                <div className="text-[11px] px-2 py-0.5 border border-white/15 bg-white/10 text-white leading-snug inline-flex items-center max-w-[80%] min-w-0 overflow-hidden rounded-full">
                  <Building2 className="h-3 w-3 mr-0.5 flex-shrink-0 text-white" />
                  <TruncatedText
                    text={companyName}
                    className="block min-w-0 flex-1 truncate leading-snug font-medium text-white"
                  />
                </div>
              </>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                <span className="text-xl font-bold text-white/50 tracking-wide">{initials}</span>
              </div>
            )}
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
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/60 rounded-full px-2.5 py-1 border border-white/15">
          <Eye className="h-3.5 w-3.5 text-white" />
          <span className="text-xs font-medium text-white">{job.views_count || 0}</span>
        </div>
      </div>

      {/* Content body */}
      <div className="job-card-mobile-body flex h-full flex-col gap-0.5 py-0.5">
        {/* Logo + Title */}
        <div className="flex flex-col items-center justify-start gap-1.5 px-2 pt-2">
          {logoUrl ? (
            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg">
              <ResilientImage src={logoUrl} alt={companyName} className="w-full h-full object-cover" draggable={false} onError={handleLogoError} fallbackClassName="w-full h-full" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-base font-bold text-white/70 tracking-wide">{initials}</span>
            </div>
          )}
          <TruncatedText
            text={job.title}
            className="w-full text-center text-[clamp(1.02rem,0.98rem+0.18vw,1.12rem)] font-bold leading-[1.32] line-clamp-2 min-h-[calc(2*1.32*clamp(1.02rem,0.98rem+0.18vw,1.12rem))]"
            style={{ color: job.overlay_text_color || '#FFFFFF' }}
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 mx-2" />

        {/* Info rows */}
        <div className="space-y-2 px-3 pb-1">
          <div className="flex items-center justify-between">
            <span className="text-sm leading-snug text-white">Rekryterare</span>
            <span className="max-w-[65%] truncate text-right text-sm leading-snug text-white font-medium">{recruiterName || '–'}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm leading-snug text-white">Anställningsform</span>
            {(() => {
              const details = formatEmploymentDetails({
                employment_type: job.employment_type,
                part_time_days: job.part_time_days,
                duration_amount: job.duration_amount,
                duration_unit: job.duration_unit,
              });
              const label = job.employment_type ? getEmploymentTypeLabel(job.employment_type) : '–';
              const combined = [label, details].filter(Boolean).join(' · ');
              return (
                <span className="text-sm leading-snug text-white font-medium text-right max-w-[65%] break-words">
                  {combined}
                </span>
              );
            })()}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm leading-snug text-white">Ansökningar</span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm leading-snug text-white font-medium">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              {job.applications_count || 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm leading-snug text-white">Plats</span>
            <span className="max-w-[65%] truncate text-right text-sm leading-snug text-white font-medium">{job.location || '–'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm leading-snug text-white">Publicerad</span>
            <span className="text-sm leading-snug text-white font-medium text-right">{formatDateShortSv(job.created_at)}</span>
          </div>
          {(() => {
            const salaryText = getJobBadgeSalary({
              salary_min: job.salary_min,
              salary_max: job.salary_max,
              salary_type: job.salary_type,
              salary_transparency: job.salary_transparency,
            });
            return (
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm leading-snug text-white">Lön</span>
                <span className="text-sm leading-snug text-white font-medium text-right max-w-[65%] break-words">
                  {salaryText || '–'}
                </span>
              </div>
            );
          })()}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm leading-snug text-white">Status</span>
                  <span className={`text-sm leading-snug font-medium ${isExpired ? 'text-red-300' : 'text-white'}`}>
                    {isExpired ? 'Utgången' : `${timeInfo.text} kvar`}
                  </span>
                </div>
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
