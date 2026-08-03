import { memo, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, Eye, Users, RotateCcw } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { getEmploymentTypeLabel, formatEmploymentDetails } from '@/lib/employmentTypes';
import { formatDateShortSv, getTimeRemaining, formatExpirationDateTime } from '@/lib/date';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isEmployerJobExpired } from '@/lib/jobStatus';
import { useCardImage } from '@/hooks/useCardImage';
import { ResilientImage } from '@/components/ui/ResilientImage';
import { getJobBadgeSalary } from '@/lib/swipeJobSalary';
import { getCompanyInitials } from '@/lib/companyInitials';
import { RemovedApplicantsInfo } from '@/components/dashboard/RemovedApplicantsInfo';


interface EmployerJobCardProps {
  job: {
    id: string;
    title: string;
    location: string;
    workplace_name?: string;
    employment_type?: string;
    part_time_days?: string[] | null;
    part_time_shifts?: string[] | null;
    duration_amount?: number | null;
    duration_unit?: string | null;
    is_active: boolean;
    views_count: number;
    applications_count: number;
    removed_applicants_count?: number;

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
  onRepublish?: (job: EmployerJobCardProps['job']) => void;
  /** Enable expand/collapse — starts collapsed showing only image + title */
  collapsible?: boolean;
  defaultExpanded?: boolean;
  /** Controlled expanded state (global "Visa detaljer") */
  expanded?: boolean;
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


export const EmployerJobCard = memo(({ job, activeTab, onClick, onRepublish, collapsible = false, defaultExpanded = false, expanded: expandedProp }: EmployerJobCardProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(expandedProp ?? defaultExpanded);
  useEffect(() => {
    if (expandedProp !== undefined) setExpanded(expandedProp);
  }, [expandedProp]);
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

  const handlePreviewClick = (e: MouseEvent) => {
    e.stopPropagation();
    try { sessionStorage.setItem('jobPreviewSource', window.location.pathname); } catch {}
    navigate(`/job/${job.id}?preview=1`);
  };

  const handleMediaClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClick(job.id);
  };

  const handleBodyClick = () => {
    if (collapsible) {
      setExpanded((v) => !v);
    } else {
      onClick(job.id);
    }
  };

  return (
    <Card
      className="job-card-mobile-shell group bg-white/5 border-white/20 overflow-hidden transition-[background-color,border-color,transform] duration-150 hover:bg-white/10 hover:border-white/30"
    >

      {/* Image header */}
      <div className="job-card-mobile-media relative w-full overflow-hidden cursor-pointer" onClick={handleMediaClick}>

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
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-6xl font-bold text-white/70 tracking-wide select-none">{initials}</span>
          </div>
        )}

        {/* Status badge — top-left */}
        <div className="absolute top-2.5 left-2.5">
          {isExpired ? (
            <Badge className="bg-red-500/80 text-white border-0 text-[11px] px-2 py-0.5">
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
      <div className="job-card-mobile-body flex h-full flex-col gap-0.5 py-0.5 cursor-pointer" onClick={handleBodyClick}>
        {/* Logo + Title */}
        <div className="flex flex-col items-center justify-start gap-1.5 px-2 pt-2">
          {logoUrl ? (
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg">
              <ResilientImage src={logoUrl} alt={companyName} className="w-full h-full object-contain p-1" draggable={false} onError={handleLogoError} fallbackClassName="w-full h-full" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-base font-bold text-white/70 tracking-wide">{initials}</span>
            </div>
          )}

          <TruncatedText
            text={job.title}
            className="w-full text-center text-[clamp(1.02rem,0.98rem+0.18vw,1.12rem)] font-bold leading-[1.32] line-clamp-2 min-h-[calc(2*1.32*clamp(1.02rem,0.98rem+0.18vw,1.12rem))]"
            style={{ color: job.overlay_text_color || '#FFFFFF' }}
          />
        </div>

        {collapsible && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              aria-label={expanded ? 'Dölj detaljer' : 'Visa detaljer'}
              aria-expanded={expanded}
              className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-1 text-xs font-medium text-white transition-colors"
            >
              <span>{expanded ? 'Dölj detaljer' : 'Visa detaljer'}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {(!collapsible || expanded) && (
            <motion.div
              key="details"
              initial={collapsible ? { height: 0, opacity: 0 } : false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              {/* Divider */}
              <div className="h-px bg-white/10 mx-2" />

              {/* Info rows — ordered by employer priority */}
              <div className="flex flex-col px-3 pb-1 [&>div]:py-2.5 [&>div]:border-b [&>div]:border-white/10 [&>div:last-child]:border-b-0">
                {/* 1. Applications — most actionable metric */}
                <div className="flex items-center justify-between">
                  <span className="text-sm leading-snug text-white">Ansökningar:</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm leading-snug text-white font-medium">
                    <Users className="h-3.5 w-3.5 flex-shrink-0" />
                    {job.applications_count || 0}
                  </span>
                </div>
                <RemovedApplicantsInfo count={job.removed_applicants_count} />


                {/* 2. Status — urgency / remaining time */}
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm leading-snug text-white">Status:</span>
                        <span className={`text-sm leading-snug font-medium ${isExpired ? 'text-red-400' : 'text-white'}`}>
                          {isExpired ? 'Utgången' : `${timeInfo.text} kvar`}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-slate-900/95 border-white/20 text-white">
                      <p className="text-xs">{formatExpirationDateTime(job.created_at, job.expires_at)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* 3. Recruiter — ownership */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm leading-snug text-white flex-shrink-0">Rekryterare:</span>
                  <TruncatedText
                    text={recruiterName || '–'}
                    className="max-w-[65%] truncate text-right text-sm leading-snug text-white font-medium"
                  />
                </div>

                {/* 4. Employment type */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm leading-snug text-white flex-shrink-0">Anställningsform:</span>
                  {(() => {
                    const details = formatEmploymentDetails({
                      employment_type: job.employment_type,
                      part_time_days: job.part_time_days,
                      part_time_shifts: job.part_time_shifts,
                      duration_amount: job.duration_amount,
                      duration_unit: job.duration_unit,
                    });
                    const label = job.employment_type ? getEmploymentTypeLabel(job.employment_type) : '–';
                    const combined = [label, details].filter(Boolean).join(' · ');
                    return (
                      <TruncatedText
                        text={combined || '–'}
                        className="text-sm leading-snug text-white font-medium text-right truncate max-w-[65%]"
                      />
                    );
                  })()}
                </div>

                {/* 5. Location */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm leading-snug text-white flex-shrink-0">Plats:</span>
                  <TruncatedText
                    text={job.location || '–'}
                    className="max-w-[65%] truncate text-right text-sm leading-snug text-white font-medium"
                  />
                </div>

                {/* 6. Start date */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm leading-snug text-white flex-shrink-0">Startdatum:</span>
                  <span className="text-sm leading-snug text-white font-medium text-right">
                    {(job as any).start_date
                      ? new Date((job as any).start_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Omgående'}
                  </span>
                </div>

                {/* 7. Published date */}
                <div className="flex items-center justify-between">
                  <span className="text-sm leading-snug text-white">Publicerad:</span>
                  <span className="text-sm leading-snug text-white font-medium text-right">{formatDateShortSv(job.created_at)}</span>
                </div>

                {/* 8. Salary */}
                {(() => {
                  const salaryText = getJobBadgeSalary({
                    salary_min: job.salary_min,
                    salary_max: job.salary_max,
                    salary_type: job.salary_type,
                    salary_transparency: job.salary_transparency,
                  });
                  return (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm leading-snug text-white flex-shrink-0">Lön:</span>
                      <TruncatedText
                        text={salaryText || '–'}
                        className="text-sm leading-snug text-white font-medium text-right truncate max-w-[65%]"
                      />
                    </div>
                  );
                })()}
              </div>

              <div className="h-px bg-white/10 mx-2" />
              <div className="flex gap-2 px-2 py-1.5">
                <Button
                  variant="glass"
                  size="sm"
                  aria-label="Förhandsgranska annons"
                  title="Förhandsgranska annons"
                  onClick={handlePreviewClick}
                  className="flex-1 h-11 transition-[background-color,border-color] duration-150 hover:bg-white/20"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Visa annons
                </Button>

                {isExpired && onRepublish && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRepublish(job);
                    }}
                    className="flex-1 h-11 rounded-full border-0 !bg-green-500 hover:!bg-green-600 text-white transition-[background-color,transform] duration-150 active:scale-[0.97]"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Återpublicera
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </Card>
  );
});

EmployerJobCard.displayName = 'EmployerJobCard';
