import { memo, useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, Eye, Users, Edit, Trash2, RotateCcw } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { getEmploymentTypeLabel, formatEmploymentDetails } from '@/lib/employmentTypes';
import { formatDateShortSv, getTimeRemaining } from '@/lib/date';
import { isEmployerJobDraft, isEmployerJobExpired } from '@/lib/jobStatus';
import { useCardImage } from '@/hooks/useCardImage';
import { useCompactWidth } from '@/hooks/useCompactWidth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { JobPosting } from '@/hooks/useJobsData';
import { getJobOverlayTextStyle } from '@/lib/jobOverlayText';
import { getCompanyInitials } from '@/lib/companyInitials';


interface MobileJobCardProps {
  job: JobPosting;
  onEdit: (job: JobPosting) => void;
  onDelete: (job: JobPosting) => void;
  onEditDraft?: (job: JobPosting) => void;
  onPrefetch?: (jobId: string) => void;
  onRepublish?: (job: JobPosting) => void;
  /** Card index in list — first 6 load eagerly, rest lazy */
  cardIndex?: number;
  /** Hide Redigera/Ta bort action buttons (used on read-only dashboard view) */
  hideActions?: boolean;
  /** Enable expand/collapse — starts collapsed showing only image + title */
  collapsible?: boolean;
  /** Optional initial expanded state when collapsible */
  defaultExpanded?: boolean;
  /** Controlled expanded state — when set, syncs local state (used for global "Visa detaljer") */
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

/** Hover-etikett för kortets åtgärdsknappar (visas i både ikon- och textläge) */
const ActionTip = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="bg-slate-900/95 border-white/20 text-white">
        {label}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);


export const MobileJobCard = memo(({ job, onEdit, onDelete, onEditDraft, onPrefetch, onRepublish, cardIndex = 0, hideActions = false, collapsible = false, defaultExpanded = false, expanded: expandedProp }: MobileJobCardProps) => {
  const navigate = useNavigate();
  // Textetiketter kräver plats för "Återpublicera" + "Ta bort" utan avklippning;
  // under detta går knapparna över till rena ikoner (med tooltip vid hover).
  const { ref: actionsRef, compact: compactActions } = useCompactWidth(380);
  const [expanded, setExpanded] = useState(expandedProp ?? defaultExpanded);
  // Sync with controlled prop (used for global "Visa detaljer alla")
  useEffect(() => {
    if (expandedProp !== undefined) setExpanded(expandedProp);
  }, [expandedProp]);
  const isDraft = isEmployerJobDraft(job);
  const isExpired = isEmployerJobExpired(job);
  const timeInfo = getTimeRemaining(job.created_at, job.expires_at);
  const companyName = job.workplace_name?.trim() || 'Okänt företag';
  const recruiterName = job.employer_profile?.first_name && job.employer_profile?.last_name
    ? `${job.employer_profile.first_name} ${job.employer_profile.last_name}`
    : null;

  // Centraliserad bild-hantering — eliminerar 14 hooks per kort
  // 🚀 Transform: kortbild ~600px bred / ~400px hög, logo ~48px → 5-10× mindre filer, snabbare listor
  const { displayUrl, handleError: handleImageError } = useCardImage(job.job_image_url, 'job-images', undefined, { width: 600, height: 400, quality: 75, resize: 'cover' });
  const { displayUrl: logoUrl, handleError: handleLogoError } = useCardImage(job.company_logo_url, 'company-logos', undefined, { width: 64, height: 64, quality: 80, resize: 'contain' });
  const gradient = useMemo(() => getGradientForId(job.id), [job.id]);
  const initials = useMemo(() => getCompanyInitials(companyName), [companyName]);
  const overlayTextStyle = useMemo(() => getJobOverlayTextStyle(job.overlay_text_color), [job.overlay_text_color]);

  const openJob = useCallback(() => {
    if (isDraft && onEditDraft) {
      onEditDraft(job);
      return;
    }
    navigate(`/job-details/${job.id}`);
  }, [isDraft, onEditDraft, job, navigate]);

  const handleMediaClick = (e: MouseEvent) => {
    e.stopPropagation();
    openJob();
  };

  const handleBodyClick = () => {
    if (collapsible) {
      setExpanded((v) => !v);
    } else {
      openJob();
    }
  };

  const handleTouchStart = () => {
    if (!isDraft && !isExpired && onPrefetch) {
      onPrefetch(job.id);
    }
  };

  const handlePreviewClick = (e: MouseEvent) => {
    e.stopPropagation();
    try { sessionStorage.setItem('jobPreviewSource', window.location.pathname); } catch {}
    navigate(`/job/${job.id}?preview=1`);
  };

  const hoverClass = isExpired
    ? '[@media(hover:hover)]:hover:bg-red-500/10 [@media(hover:hover)]:hover:border-red-500/30 active:bg-red-500/15'
    : isDraft
      ? '[@media(hover:hover)]:hover:bg-amber-500/10 [@media(hover:hover)]:hover:border-amber-500/30 active:bg-amber-500/15'
      : '[@media(hover:hover)]:hover:bg-green-500/10 [@media(hover:hover)]:hover:border-green-500/30 active:bg-green-500/15';

  return (
    <Card
      className={`job-card-mobile-shell group bg-white/5 border-white/20 overflow-hidden transition-[background-color,border-color] duration-150 ${hoverClass}`}
      style={{ contain: 'layout style paint', contentVisibility: 'auto', containIntrinsicSize: 'auto 420px' } as React.CSSProperties}
      onTouchStart={handleTouchStart}
    >
      <div
        className="job-card-mobile-media relative w-full overflow-hidden cursor-pointer"
        onClick={handleMediaClick}
      >

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
              loading={cardIndex < 6 ? 'eager' : 'lazy'}
              onError={handleImageError}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-6xl font-bold text-white/70 tracking-wide select-none">{initials}</span>
          </div>
        )}

        <div className="absolute top-2.5 left-2.5">
          {isExpired ? (
            <Badge className="bg-red-500/80 text-white border-0 text-[11px] px-2 py-0.5">
              Utgången
            </Badge>
          ) : isDraft ? (
            <Badge className="bg-amber-500/90 text-white border-0 text-[11px] px-2 py-0.5">
              Utkast
            </Badge>
          ) : (
            <Badge className="bg-green-500/90 text-white border-0 text-[11px] px-2 py-0.5">
              Aktiv
            </Badge>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/60 rounded-full px-2.5 py-1 border border-white/15">
          <Eye className="h-3.5 w-3.5 text-white" />
          <span className="text-xs font-medium text-white">{job.views_count || 0}</span>
        </div>
      </div>

      <div
        className={`job-card-mobile-body flex h-full flex-col gap-0.5 py-0.5 ${collapsible ? 'cursor-pointer' : 'cursor-pointer'}`}
        onClick={handleBodyClick}
      >
        <div className="flex justify-center mt-1 mb-1">
          {logoUrl ? (
            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden shadow-lg">
              <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" draggable={false} onError={handleLogoError} />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <span className="text-base font-bold text-white/80 tracking-wide">{initials}</span>
            </div>
          )}
        </div>
        <div className="flex min-h-[clamp(4.25rem,3.8rem+1.6vw,5.25rem)] items-start justify-center px-2">
          <TruncatedText
            text={job.title}
            className="w-full text-center text-[clamp(1.02rem,0.98rem+0.18vw,1.12rem)] font-bold leading-[1.32] text-white line-clamp-2"
            style={overlayTextStyle}
          />
        </div>


        {!(hideActions && isDraft) && (
          <div>

            <div ref={actionsRef} className={`flex gap-2 px-2 pt-0 pb-3 ${compactActions ? 'justify-center' : ''}`}>
              {!hideActions && !isExpired && (
                <ActionTip label={isDraft ? 'Redigera utkast' : 'Redigera annons'}>
                  <Button
                    variant="glass"
                    size="sm"
                    aria-label="Redigera annons"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDraft && onEditDraft) {
                        onEditDraft(job);
                      } else {
                        onEdit(job);
                      }
                    }}
                    className={`${compactActions ? 'h-11 w-11 flex-shrink-0 px-0' : 'flex-1 min-w-0 h-11 text-sm'} transition-[background-color,border-color] duration-150 hover:bg-blue-500/20 hover:border-blue-500/40`}
                  >
                    <Edit className={`h-4 w-4 ${compactActions ? '' : 'mr-2'}`} />
                    {!compactActions && <span className="truncate">Redigera</span>}
                  </Button>
                </ActionTip>
              )}
              {!hideActions && isExpired && onRepublish && (
                <ActionTip label="Återpublicera annons">
                  <Button
                    size="sm"
                    aria-label="Återpublicera annons"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRepublish(job);
                    }}
                    className={`${compactActions ? 'h-11 w-11 flex-shrink-0 px-0' : 'flex-1 min-w-0 h-11'} rounded-full border-0 !bg-green-500 hover:!bg-green-600 text-white transition-[background-color,transform] duration-150 active:scale-[0.97]`}
                  >
                    <RotateCcw className={`h-4 w-4 ${compactActions ? '' : 'mr-2'}`} />
                    {!compactActions && <span className="truncate">Återpublicera</span>}
                  </Button>
                </ActionTip>
              )}
              {!isDraft && (
                <ActionTip label="Förhandsgranska annons">
                  <Button
                    variant="glass"
                    size="sm"
                    aria-label="Förhandsgranska annons"
                    onClick={handlePreviewClick}
                    className={`${hideActions && !compactActions ? 'flex-1 min-w-0 px-3' : 'h-11 w-11 flex-shrink-0 px-0'} transition-[background-color,border-color] duration-150 hover:bg-white/20`}
                  >
                    <Eye className="h-4 w-4" />
                    {hideActions && !compactActions && <span className="text-sm truncate">Visa annons</span>}
                  </Button>
                </ActionTip>
              )}
              {!hideActions && (
                <ActionTip label="Ta bort annons">
                  <Button
                    variant="glass"
                    size="sm"
                    aria-label="Ta bort annons"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(job);
                    }}
                    className={`${compactActions ? 'h-11 w-11 flex-shrink-0 px-0' : 'flex-1 min-w-0 h-11'} rounded-full border-0 bg-red-500/80 text-white transition-[transform] duration-150 hover:bg-red-500/80 hover:text-white active:scale-[0.97]`}
                  >
                    <Trash2 className={`h-4 w-4 ${compactActions ? '' : 'mr-2'}`} />
                    {!compactActions && <span className="truncate">Ta bort</span>}
                  </Button>
                </ActionTip>
              )}
            </div>
          </div>
        )}

        {collapsible && (
          <div className="flex justify-center pt-0 pb-1">
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
              <div className="h-px bg-white/10 mx-2" />

              <div className="flex flex-col px-3 pb-1 [&>div]:py-2.5 [&>div]:border-b [&>div]:border-white/10 [&>div:last-child]:border-b-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm leading-snug text-white">Ansökningar:</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm leading-snug text-white font-medium">
                    <Users className="h-3.5 w-3.5 flex-shrink-0" />
                    {job.applications_count || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm leading-snug text-white">Status:</span>
                  <span className={`text-sm leading-snug font-medium ${isExpired ? 'text-red-400' : isDraft ? 'text-amber-300' : 'text-white'}`}>
                    {isExpired ? 'Utgången' : isDraft ? 'Utkast' : `${timeInfo.text} kvar`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm leading-snug text-white flex-shrink-0">Rekryterare:</span>
                  <TruncatedText
                    text={recruiterName || '–'}
                    className="max-w-[65%] truncate text-right text-sm leading-snug text-white font-medium"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm leading-snug text-white flex-shrink-0">Anställningsform:</span>
                  <TruncatedText
                    text={job.employment_type ? [getEmploymentTypeLabel(job.employment_type), formatEmploymentDetails(job as any)].filter(Boolean).join(' · ') : '–'}
                    className="max-w-[65%] truncate text-right text-sm leading-snug text-white font-medium"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm leading-snug text-white flex-shrink-0">Plats:</span>
                  <TruncatedText
                    text={job.location || '–'}
                    className="max-w-[65%] truncate text-right text-sm leading-snug text-white font-medium"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm leading-snug text-white flex-shrink-0">Startdatum:</span>
                  <span className="text-sm leading-snug text-white font-medium text-right">
                    {(job as any).start_date
                      ? new Date((job as any).start_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Omgående'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm leading-snug text-white">Publicerad:</span>
                  <span className="text-sm leading-snug text-white font-medium text-right">{formatDateShortSv(job.created_at)}</span>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>



      </div>
    </Card>
  );
});

MobileJobCard.displayName = 'MobileJobCard';
