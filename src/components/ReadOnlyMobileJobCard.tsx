import { memo, useMemo, useCallback, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, MapPin, Building2, Heart, Timer, CheckCircle, Briefcase, UserCheck, Trash2, Gift, Banknote, Clock } from 'lucide-react';
import { getEmploymentTypeLabel, formatEmploymentDetails, formatPartTimeDays, formatPartTimeShifts } from '@/lib/employmentTypes';
import { getTimeRemaining } from '@/lib/date';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { useCardImage } from '@/hooks/useCardImage';
import { JOB_VIEW_HERO_TRANSFORM, getImageVersion } from '@/lib/imageTransforms';
import { ResilientImage } from '@/components/ui/ResilientImage';
import { TruncatedText } from '@/components/TruncatedText';
import { getJobOverlayTextStyle } from '@/lib/jobOverlayText';
import { toObjectPosition } from '@/lib/jobImageFocus';
import { imageCache } from '@/lib/imageCache';
import { supabase } from '@/integrations/supabase/client';
import { appendVersionToUrl } from '@/lib/versionedMediaUrl';
import { saveScrollNow } from '@/lib/scrollRestoration';
import { getCompanyInitials } from '@/lib/companyInitials';
import { hapticLight } from '@/lib/haptics';


interface ReadOnlyMobileJobCardProps {
  job: {
    id: string;
    title: string;
    location: string;
    employment_type?: string;
    part_time_days?: string[] | null;
    part_time_shifts?: string[] | null;
    duration_amount?: number | null;
    duration_unit?: string | null;
    is_active: boolean;
    views_count: number;
    applications_count: number;
    created_at: string;
    expires_at?: string;
    job_image_url?: string;
    job_image_desktop_url?: string;
    image_focus_position?: string;
    company_name?: string;
    workplace_name?: string;
    employer_id?: string;
    company_logo_url?: string;
    overlay_text_color?: string | null;
    updated_at?: string;
    image_updated_at?: string | null;
    positions_count?: number;
    salary_min?: number | null;
    salary_max?: number | null;
    salary_type?: string | null;
    salary_transparency?: string | null;
    benefits?: string[] | null;
    profiles?: {
      company_name: string | null;
    };
    employer_profile?: {
      first_name: string;
      last_name: string;
    };
  };
  hasApplied?: boolean;
  /** If provided, heart-unsave click calls this instead of toggling directly */
  onUnsaveClick?: (jobId: string, jobTitle: string) => void;
  /** If provided, shows trash icon instead of heart and calls this on click */
  onDeleteClick?: (jobId: string, jobTitle: string) => void;
  /** External saved state - if provided, used instead of internal hook */
  isSavedExternal?: boolean;
  /** External toggle function - if provided, used instead of internal hook */
  onToggleSave?: (jobId: string) => void;
  /** Custom status badge to show on top-left (replaces "Redan sökt" badge) */
  statusBadge?: ReactNode;
  /** Hide the save/heart button entirely */
  hideSaveButton?: boolean;
  /** Override default card click navigation */
  onCardClick?: (jobId: string, imageState?: { initialHeroImageUrl?: string; initialCompanyLogoUrl?: string; hasApplied?: boolean }) => void;
  /** Opens the company profile without triggering the card navigation */
  onCompanyClick?: (companyId: string) => void;
  /** Extra content rendered below the tags row (e.g. edit/delete buttons) */
  footer?: ReactNode;
  /** Card index in list — first 6 load eagerly, rest lazy */
  cardIndex?: number;
}

// Deterministic gradient based on job id for visual variety
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


export const ReadOnlyMobileJobCard = memo(({ job, hasApplied = false, onUnsaveClick, onDeleteClick, isSavedExternal, onToggleSave, statusBadge, hideSaveButton = false, onCardClick, onCompanyClick, footer, cardIndex = 0 }: ReadOnlyMobileJobCardProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Centraliserad bild-hantering — eliminerar 12 hooks per kort.
  // Använder samma hook som MobileJobCard så båda korten har identisk render-kostnad.
  // 🚀 Transform: kortbild ~600x400 (5-10× mindre), logo ~64px
  const imageVersion = getImageVersion(job);
  const cardImageSource = job.job_image_url ?? job.job_image_desktop_url ?? null;
  const { displayUrl, handleError: handleImageError } = useCardImage(cardImageSource, 'job-images', imageVersion, { width: 600, height: 300, quality: 75, resize: 'cover' });
  const { displayUrl: logoUrl, handleError: handleLogoError } = useCardImage(job.company_logo_url ?? null, 'company-logos', imageVersion, { width: 64, height: 64, quality: 80, resize: 'contain' });

  const companyName = job.workplace_name || job.company_name || 'Okänt företag';
  const { text: timeText, isExpired } = getTimeRemaining(job.created_at, job.expires_at);
  const gradient = useMemo(() => getGradientForId(job.id), [job.id]);
  const initials = useMemo(() => getCompanyInitials(companyName), [companyName]);
  const overlayTextStyle = useMemo(() => getJobOverlayTextStyle(job.overlay_text_color), [job.overlay_text_color]);
  const getCachedJobViewHeroUrl = useCallback(() => {
    const raw = job.job_image_url || (job as any).job_image_desktop_url;
    if (!raw) return null;
    try {
      const base = raw.startsWith('http')
        ? raw
        : supabase.storage.from('job-images').getPublicUrl(raw, {
            transform: JOB_VIEW_HERO_TRANSFORM,
          }).data.publicUrl;
      const resolved = appendVersionToUrl(base, imageVersion);
      return resolved ? imageCache.getCachedUrl(resolved) : null;
    } catch {
      return null;
    }
  }, [job.job_image_url, (job as any).job_image_desktop_url, imageVersion]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteClick?.(job.id, job.title);
  };

  const canOpenCompanyProfile = Boolean(job.employer_id && onCompanyClick);
  const openCompanyProfile = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
    hapticLight();
    if (job.employer_id) onCompanyClick?.(job.employer_id);
  }, [job.employer_id, onCompanyClick]);
  const handleCompanyKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCompanyProfile(e);
    }
  }, [openCompanyProfile]);
  const stopPointer = useCallback((e: React.PointerEvent) => e.stopPropagation(), []);

  // Determine which action button to show
  const showDeleteButton = !!onDeleteClick;
  const showSaveButton = !hideSaveButton && !showDeleteButton;
  const canUseExternalSaveOnly = isSavedExternal !== undefined && !!onToggleSave;

  // Warm imageCache with the full-size JobView hero on pointerdown so it's
  // instantly available when the JobView page mounts (no right-to-left load).
  const warmJobViewImage = useCallback(() => {
    // Warm BOTH mobile- and desktop-source hero URLs with the SAME transform JobView
    // applies (contain, 1200x800, q75). Any mismatch creates a parallel cache entry
    // and triggers the visible "right-to-left" reload on navigation.
    const candidates = [
      job.job_image_url,
      (job as any).job_image_desktop_url,
    ].filter(Boolean) as string[];
    for (const raw of candidates) {
      try {
        const base = raw.startsWith('http')
          ? raw
          : supabase.storage.from('job-images').getPublicUrl(raw, {
              transform: JOB_VIEW_HERO_TRANSFORM,
            }).data.publicUrl;
        // VIKTIGT: append samma v=-version som SearchJobs och JobView använder,
        // annars hamnar varmningen i en separat cache-slot och JobView missar träffen.
        const resolved = appendVersionToUrl(base, imageVersion);
        if (resolved && !imageCache.isCached(resolved)) {
          imageCache.loadImage(resolved).catch(() => {});
        }
      } catch {}
    }
  }, [job.id, job.job_image_url, (job as any).job_image_desktop_url, imageVersion]);

  return (
    <Card 
      data-scroll-anchor-id={job.id}
      className="job-card-mobile-shell group bg-white/5 border-white/20 overflow-hidden cursor-pointer transition-[background-color,border-color] duration-150"
      style={{ contain: 'layout style paint', contentVisibility: 'auto', containIntrinsicSize: 'auto 420px' } as React.CSSProperties}
      onPointerDown={() => {
        warmJobViewImage();
        // Snapshota exakt scroll-position synkront innan navigation,
        // så tillbaka-knappen alltid landar på exakt rätt kort.
        try { saveScrollNow(window.location.pathname); } catch {}
      }}
      onClick={() => {
        const instantHeroUrl = getCachedJobViewHeroUrl();
        const imageState = {
          ...(instantHeroUrl ? { initialHeroImageUrl: instantHeroUrl } : {}),
          ...(logoUrl ? { initialCompanyLogoUrl: logoUrl } : {}),
          ...(hasApplied ? { hasApplied: true } : {}),
        };
        onCardClick
          ? onCardClick(job.id, imageState)
          : navigate(`/job-view/${job.id}`, { state: { background: location, ...imageState } });
      }}
    >
      {/* Visual header — image or gradient placeholder */}
      <div className="job-card-mobile-media relative w-full overflow-hidden">
        {displayUrl ? (
          <>
            <ResilientImage
              src={displayUrl}
              alt={`${job.title} hos ${companyName}`}
              className="w-full h-full object-cover"
              style={{ objectPosition: toObjectPosition(job.image_focus_position) }}
              loading={cardIndex < 6 ? 'eager' : 'lazy'}
              onError={handleImageError}
              fallbackClassName="w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        ) : (
          /* Gradient placeholder with large company initials — matches employer card */
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-6xl font-bold text-white/70 tracking-wide select-none">{initials}</span>
          </div>
        )}
        
        {/* Action button — delete (trash) or save (heart) */}
        {showDeleteButton && (
          <button
            onClick={handleDeleteClick}
            aria-label="Dölj ansökan i din lista"
            className="absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full border-0 bg-red-500/80 text-white md:hover:!bg-red-500/80 md:hover:!text-white"
          >
            <Trash2 className="h-4 w-4 text-white" />
          </button>
        )}
        {showSaveButton && (
          canUseExternalSaveOnly ? (
            <ExternalSaveButton
              jobId={job.id}
              jobTitle={job.title}
              isSaved={!!isSavedExternal}
              onToggleSave={onToggleSave!}
              onUnsaveClick={onUnsaveClick}
            />
          ) : (
            <InternalSaveButton
              jobId={job.id}
              jobTitle={job.title}
              forcedIsSaved={isSavedExternal}
              onToggleSave={onToggleSave}
              onUnsaveClick={onUnsaveClick}
            />
          )
        )}

        {/* Views count badge — top-left when save button is hidden */}
        {hideSaveButton && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/60 rounded-full px-2.5 py-1 border border-white/15">
            <Eye className="h-3.5 w-3.5 text-white" />
            <span className="text-xs font-medium text-white">{job.views_count}</span>
          </div>
        )}

        {/* Status badge or Applied badge — top-left */}
        {statusBadge && (
          <div className="absolute top-2.5 left-2.5">
            {statusBadge}
          </div>
        )}
        {!statusBadge && hasApplied && (
          <div className="absolute top-2.5 left-2.5">
            <Badge className="bg-green-500 text-white border-0 text-[11px] px-2 py-0.5">
              <CheckCircle className="h-3 w-3 mr-1" />
              Redan sökt
            </Badge>
          </div>
        )}
        {/* Time-remaining badge — top-left when the slot is free (snabbare vy).
            När "Redan sökt"/statusBadge tar top-left visas tiden i taggraden nedan istället. */}
        {!statusBadge && !hasApplied && (
          <div className="absolute top-2.5 left-2.5">
            <Badge
              variant={isExpired ? 'default' : 'glass'}
              className={`text-[11px] px-2 py-0.5 leading-snug inline-flex items-center text-white ${isExpired ? 'bg-red-500/80 border-0' : 'bg-black/60 border-white/15'}`}
            >
              <Timer className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="leading-snug">{isExpired ? 'Utgången' : `${timeText} kvar`}</span>
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
       <div className="job-card-mobile-body space-y-2.5">
        {/* Logo circle — always shown, matches employer card */}
        <div className="flex justify-center pt-1">
          <div
            className="w-14 h-14 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden shadow-lg shrink-0 touch-manipulation select-none"
            role={canOpenCompanyProfile ? 'button' : undefined}
            aria-label={canOpenCompanyProfile ? `Visa företagsprofil för ${companyName}` : undefined}
            tabIndex={canOpenCompanyProfile ? 0 : undefined}
            onPointerDown={canOpenCompanyProfile ? stopPointer : undefined}
            onClick={canOpenCompanyProfile ? openCompanyProfile : undefined}
            onKeyDown={canOpenCompanyProfile ? handleCompanyKeyDown : undefined}
            style={canOpenCompanyProfile ? { cursor: 'pointer' } : undefined}
          >
            {logoUrl ? (
              <ResilientImage src={logoUrl} alt={companyName} className="w-full h-full object-cover rounded-full" draggable={false} onError={handleLogoError} fallbackClassName="w-full h-full" />
            ) : (
              <span className="text-base font-bold text-white/80 tracking-wide">{initials}</span>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <TruncatedText
            text={job.title}
            className="text-base font-bold leading-snug line-clamp-2 text-center"
            style={overlayTextStyle}
          />
        </div>

        {/* Company + Location — glass badges, centered, truncation-safe */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap min-w-0">
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center max-w-[55%] min-w-0 overflow-hidden text-white">
            <Building2 className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <TruncatedText
              text={companyName}
              className="leading-snug font-medium whitespace-nowrap overflow-hidden text-ellipsis min-w-0 flex-1"
            />
          </Badge>
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center max-w-[42%] overflow-hidden text-white">
            <MapPin className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="leading-snug truncate">{job.location}</span>
          </Badge>
        </div>


        {/* Tags row — badges restored, centered */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {job.employment_type && (() => {
            const label = getEmploymentTypeLabel(job.employment_type);
            const daysStr = formatPartTimeDays((job as any).part_time_days);
            const shiftsStr = formatPartTimeShifts((job as any).part_time_shifts);
            // Deltid med både dagar OCH pass → samlat i ett chip med tydlig raddelning.
            if (job.employment_type === 'part_time' && daysStr && shiftsStr) {
              return (
                <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-start text-white">
                  <Briefcase className="h-3 w-3 mr-1 mt-[3px] flex-shrink-0" />
                  <span className="leading-snug flex flex-col items-center text-center gap-0.5">
                    <span className="w-full text-left">{label} · {daysStr}</span>
                    <span className="inline-flex items-center justify-center gap-1 text-white/95">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      {shiftsStr}
                    </span>
                  </span>
                </Badge>
              );
            }
            const detail = formatEmploymentDetails(job as any);
            return (
              <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center text-white">
                <Briefcase className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="leading-snug">{[label, detail].filter(Boolean).join(' · ')}</span>
              </Badge>
            );
          })()}
          {/* Salary badge */}
          {(() => {
            let salaryText: string | null = null;
            const typeLabel = job.salary_type === 'monthly' || job.salary_type === 'fast' ? 'kr/mån'
              : job.salary_type === 'hourly' || job.salary_type === 'rorlig' ? 'kr/tim'
              : job.salary_type === 'fast-rorlig' ? 'kr/mån' : 'kr/mån';

            if (job.salary_transparency === 'after_interview') {
              salaryText = 'Lön efter intervju';
            } else if (job.salary_min || job.salary_max) {
              if (job.salary_min && job.salary_max) {
                salaryText = `${job.salary_min.toLocaleString('sv-SE')} – ${job.salary_max.toLocaleString('sv-SE')} ${typeLabel}`;
              } else {
                salaryText = `Från ${(job.salary_min || job.salary_max)!.toLocaleString('sv-SE')} ${typeLabel}`;
              }
            } else if (job.salary_transparency && /^\d/.test(job.salary_transparency)) {
              const match = job.salary_transparency.match(/^(\d+)\s*[-–]\s*(\d+)$/);
              if (match) {
                salaryText = `${parseInt(match[1], 10).toLocaleString('sv-SE')} – ${parseInt(match[2], 10).toLocaleString('sv-SE')} ${typeLabel}`;
              } else {
                salaryText = `${job.salary_transparency} ${typeLabel}`;
              }
            }
            if (!salaryText) return null;
            return (
              <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center text-white">
                <Banknote className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="leading-snug">{salaryText}</span>
              </Badge>
            );
          })()}
          {/* Tid visas i taggraden endast när top-left är upptagen (statusBadge / Redan sökt).
              Annars ligger tid-badgen som overlay uppe i hörnet för snabbare skanning. */}
          {(statusBadge || hasApplied) && !(isExpired && statusBadge) && (
            <Badge variant={isExpired ? 'default' : 'glass'} className={`text-[11px] px-2 py-0.5 leading-snug inline-flex items-center text-white ${isExpired ? 'bg-red-500/80 border-0' : 'border-white/15'}`}>
              <Timer className="h-3 w-3 mr-0.5 flex-shrink-0" />
              <span className="leading-snug">{isExpired ? 'Utgången' : `${timeText} kvar`}</span>
            </Badge>
          )}
          {job.benefits && job.benefits.length > 0 && (
            <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center text-white">
              <Gift className="h-3 w-3 mr-0.5 flex-shrink-0" />
              <span className="leading-snug">
                Förmåner {job.benefits.length <= 5 ? `${job.benefits.length} st` : `${Math.floor(job.benefits.length / 5) * 5}+`}
              </span>
            </Badge>
          )}
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center text-white">
            <Users className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="leading-snug">{job.applications_count || 0} sökande</span>
          </Badge>
        </div>
        {footer ? <div>{footer}</div> : null}
      </div>
    </Card>
  );
});

interface SaveButtonProps {
  jobId: string;
  jobTitle: string;
  isSaved: boolean;
  onToggle: (jobId: string) => void;
  onUnsaveClick?: (jobId: string, jobTitle: string) => void;
}

const SaveButton = memo(({ jobId, jobTitle, isSaved, onToggle, onUnsaveClick }: SaveButtonProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved && onUnsaveClick) {
      onUnsaveClick(jobId, jobTitle);
      return;
    }
    onToggle(jobId);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={isSaved ? 'Ta bort från sparade' : 'Spara jobb'}
      className="absolute top-2.5 right-2.5 h-9 w-9 flex items-center justify-center rounded-full bg-black/50 border border-white/20 transition-colors"
    >
      <Heart className={`h-4 w-4 ${isSaved ? 'fill-red-400 text-red-400' : 'text-white'}`} />
    </button>
  );
});

interface InternalSaveButtonProps {
  jobId: string;
  jobTitle: string;
  forcedIsSaved?: boolean;
  onToggleSave?: (jobId: string) => void;
  onUnsaveClick?: (jobId: string, jobTitle: string) => void;
}

const InternalSaveButton = memo(({ jobId, jobTitle, forcedIsSaved, onToggleSave, onUnsaveClick }: InternalSaveButtonProps) => {
  const { isJobSaved, toggleSaveJob } = useSavedJobs();
  const isSaved = forcedIsSaved !== undefined ? forcedIsSaved : isJobSaved(jobId);
  const onToggle = onToggleSave || toggleSaveJob;

  return (
    <SaveButton
      jobId={jobId}
      jobTitle={jobTitle}
      isSaved={isSaved}
      onToggle={onToggle}
      onUnsaveClick={onUnsaveClick}
    />
  );
});

interface ExternalSaveButtonProps {
  jobId: string;
  jobTitle: string;
  isSaved: boolean;
  onToggleSave: (jobId: string) => void;
  onUnsaveClick?: (jobId: string, jobTitle: string) => void;
}

const ExternalSaveButton = memo(({ jobId, jobTitle, isSaved, onToggleSave, onUnsaveClick }: ExternalSaveButtonProps) => {
  return (
    <SaveButton
      jobId={jobId}
      jobTitle={jobTitle}
      isSaved={isSaved}
      onToggle={onToggleSave}
      onUnsaveClick={onUnsaveClick}
    />
  );
});

ReadOnlyMobileJobCard.displayName = 'ReadOnlyMobileJobCard';
