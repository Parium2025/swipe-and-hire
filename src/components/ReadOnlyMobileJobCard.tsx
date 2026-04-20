import { memo, useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, MapPin, Building2, Heart, Timer, CheckCircle, Briefcase, UserCheck, Trash2, Gift, Banknote } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { getTimeRemaining } from '@/lib/date';
import { supabase } from '@/integrations/supabase/client';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { imageCache } from '@/lib/imageCache';
import { TruncatedText } from '@/components/TruncatedText';
import { appendVersionToUrl } from '@/lib/versionedMediaUrl';

interface ReadOnlyMobileJobCardProps {
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
    company_name?: string;
    workplace_name?: string;
    company_logo_url?: string;
    updated_at?: string;
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
  onCardClick?: (jobId: string) => void;
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

/** Get initials from company name: 
 *  - 1 word → first + last letter (e.g. "Hoffstens" → "HS")
 *  - 2+ words → first letter of first + first letter of last word (e.g. "Hoffstens Motor" → "HM")
 */
function getCompanyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    const w = words[0];
    return (w[0] + w[w.length - 1]).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export const ReadOnlyMobileJobCard = memo(({ job, hasApplied = false, onUnsaveClick, onDeleteClick, isSavedExternal, onToggleSave, statusBadge, hideSaveButton = false, onCardClick, footer, cardIndex = 0 }: ReadOnlyMobileJobCardProps) => {
  const navigate = useNavigate();

  // Resolve the raw storage path to a public URL
  const resolvedUrl = useMemo(() => {
    if (!job.job_image_url) return null;
    if (job.job_image_url.startsWith('http')) return job.job_image_url;
    const { data } = supabase.storage.from('job-images').getPublicUrl(job.job_image_url);
    return data?.publicUrl || null;
  }, [job.job_image_url]);

  // Synchronous cache check — computed every render, zero-delay on remount
  const cachedBlobUrl = useMemo(() => {
    if (!resolvedUrl) return null;
    return imageCache.getCachedUrl(resolvedUrl);
  }, [resolvedUrl]);

  // If not blob-cached yet, load in background
  const [loadedBlobUrl, setLoadedBlobUrl] = useState<string | null>(null);
  // Fallback flag: if blob URL becomes invalid (iOS memory pressure), use raw URL
  const [blobFailed, setBlobFailed] = useState(false);

  useEffect(() => {
    setLoadedBlobUrl(null);
    setBlobFailed(false);
  }, [resolvedUrl]);

  useEffect(() => {
    if (!resolvedUrl || cachedBlobUrl) {
      setLoadedBlobUrl(null);
      return;
    }
    setBlobFailed(false);
    let cancelled = false;
    imageCache.loadImage(resolvedUrl)
      .then(blobUrl => { if (!cancelled) setLoadedBlobUrl(blobUrl); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [resolvedUrl, cachedBlobUrl]);

  // Priority: blob from cache (instant) → blob from load → raw URL
  // If blob failed (revoked by OS), skip blob entirely and use raw URL
  const displayUrl = blobFailed ? resolvedUrl : (cachedBlobUrl || loadedBlobUrl || resolvedUrl);

  // Handle image load errors (blob URL revocation on iOS)
  const handleImageError = useMemo(() => {
    return (e: React.SyntheticEvent<HTMLImageElement>) => {
      const src = e.currentTarget.src;
      if (src.startsWith('blob:')) {
        // Blob was revoked — evict from cache and fall back to raw URL
        if (resolvedUrl) imageCache.evict(resolvedUrl);
        setBlobFailed(true);
      }
    };
  }, [resolvedUrl]);

  const companyName = job.workplace_name || job.company_name || 'Okänt företag';
  const { text: timeText, isExpired } = getTimeRemaining(job.created_at, job.expires_at);
  const gradient = useMemo(() => getGradientForId(job.id), [job.id]);
  const initials = useMemo(() => getCompanyInitials(companyName), [companyName]);
  const rawLogoUrl = useMemo(() => {
    if (!job.company_logo_url) return null;
    if (job.company_logo_url.startsWith('http')) return job.company_logo_url;
    const publicUrl = supabase.storage.from('company-logos').getPublicUrl(job.company_logo_url).data?.publicUrl || null;
    return appendVersionToUrl(publicUrl, job.updated_at);
  }, [job.company_logo_url, job.updated_at]);
  const cachedLogoBlob = useMemo(() => rawLogoUrl ? imageCache.getCachedUrl(rawLogoUrl) : null, [rawLogoUrl]);
  const [loadedLogoBlob, setLoadedLogoBlob] = useState<string | null>(null);
  const [logoBlobFailed, setLogoBlobFailed] = useState(false);

  useEffect(() => {
    setLoadedLogoBlob(null);
    setLogoBlobFailed(false);
  }, [rawLogoUrl]);

  useEffect(() => {
    if (!rawLogoUrl || cachedLogoBlob) { setLoadedLogoBlob(null); return; }
    setLogoBlobFailed(false);
    let cancelled = false;
    imageCache.loadImage(rawLogoUrl).then(b => { if (!cancelled) setLoadedLogoBlob(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [rawLogoUrl, cachedLogoBlob]);
  const logoUrl = logoBlobFailed ? rawLogoUrl : (cachedLogoBlob || loadedLogoBlob || rawLogoUrl);

  const handleLogoError = useMemo(() => {
    return (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (e.currentTarget.src.startsWith('blob:')) {
        if (rawLogoUrl) imageCache.evict(rawLogoUrl);
        setLogoBlobFailed(true);
      }
    };
  }, [rawLogoUrl]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteClick?.(job.id, job.title);
  };

  // Determine which action button to show
  const showDeleteButton = !!onDeleteClick;
  const showSaveButton = !hideSaveButton && !showDeleteButton;
  const canUseExternalSaveOnly = isSavedExternal !== undefined && !!onToggleSave;

  return (
    <Card 
      data-scroll-anchor-id={job.id}
      className="job-card-mobile-shell group bg-white/5 border-white/20 overflow-hidden cursor-pointer transition-[background-color,border-color] duration-150"
      onClick={() => onCardClick ? onCardClick(job.id) : navigate(`/job-view/${job.id}`)}
    >
      {/* Visual header — image or gradient placeholder */}
      <div className="job-card-mobile-media relative w-full overflow-hidden animate-fade-in">
        {displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt={`${job.title} hos ${companyName}`}
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
          /* Gradient placeholder with company initials */
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 pb-6`}>
            {logoUrl ? (
              <>
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                  <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" draggable={false} onError={handleLogoError} />
                </div>
                <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center max-w-[80%] overflow-hidden">
                  <Building2 className="h-3 w-3 mr-0.5 flex-shrink-0 text-white" />
                  <span className="leading-snug truncate font-medium text-white">{companyName}</span>
                </Badge>
              </>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                <span className="text-xl font-bold text-white/50 tracking-wide">{initials}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Action button — delete (trash) or save (heart) */}
        {showDeleteButton && (
          <button
            onClick={handleDeleteClick}
            aria-label="Ta bort ansökan"
            className="absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-destructive/40 bg-destructive/20 text-white transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
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
            <Badge className="bg-green-500/90 text-white border-0 text-[11px] px-2 py-0.5">
              <CheckCircle className="h-3 w-3 mr-1" />
              Redan sökt
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
       <div className="job-card-mobile-body space-y-2.5">
        {/* Title */}
        <div className="animate-fade-in">
          <TruncatedText
            text={job.title}
            className="text-base font-bold text-white leading-snug line-clamp-2 text-center"
          />
        </div>

        {/* Company + Location — glass badges, centered, truncation-safe */}
        {/* Only show company badge when there's a job image (otherwise it's already in the gradient) */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap min-w-0">
          {(displayUrl || !logoUrl) && (
            <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center max-w-[55%] overflow-hidden text-white">
              <Building2 className="h-3 w-3 mr-0.5 flex-shrink-0" />
              <span className="leading-snug truncate font-medium">{companyName}</span>
            </Badge>
          )}
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center max-w-[42%] overflow-hidden text-white">
            <MapPin className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="leading-snug truncate">{job.location}</span>
          </Badge>
        </div>

        {/* Tags row — badges restored, centered */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {job.employment_type && (
            <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center text-white">
              <Briefcase className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="leading-snug">{getEmploymentTypeLabel(job.employment_type)}</span>
            </Badge>
          )}
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
          {!(isExpired && statusBadge) && (
            <Badge variant="glass" className={`text-[11px] px-2 py-0.5 border-white/15 leading-snug inline-flex items-center text-white ${isExpired ? 'bg-red-500/20 text-red-300 border-red-500/30' : ''}`}>
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
        {footer ? <div className="animate-fade-in">{footer}</div> : null}
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
