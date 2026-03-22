import { memo, useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, MapPin, Building2, Heart, Timer, CheckCircle, Briefcase, UserCheck, Trash2 } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { getTimeRemaining } from '@/lib/date';
import { supabase } from '@/integrations/supabase/client';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { imageCache } from '@/lib/imageCache';
import { TruncatedText } from '@/components/TruncatedText';

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
    company_name?: string;
    positions_count?: number;
    profiles?: {
      company_name: string | null;
    };
    employer_profile?: {
      first_name: string;
      last_name: string;
      company_name: string | null;
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

export const ReadOnlyMobileJobCard = memo(({ job, hasApplied = false, onUnsaveClick, onDeleteClick, isSavedExternal, onToggleSave, statusBadge, hideSaveButton = false, onCardClick, footer }: ReadOnlyMobileJobCardProps) => {
  const navigate = useNavigate();
  const { isJobSaved, toggleSaveJob } = useSavedJobs();

  // Use external state if provided, otherwise fall back to internal hook
  const isSaved = isSavedExternal !== undefined ? isSavedExternal : isJobSaved(job.id);
  const doToggle = onToggleSave || toggleSaveJob;

  // Resolve the raw storage path to a public URL
  const resolvedUrl = useMemo(() => {
    if (!job.job_image_url) return null;
    if (job.job_image_url.startsWith('http')) return job.job_image_url;
    const { data } = supabase.storage.from('job-images').getPublicUrl(job.job_image_url);
    return data?.publicUrl || null;
  }, [job.job_image_url]);

  // Use imageCache for blob caching
  const [displayUrl, setDisplayUrl] = useState<string | null>(() => {
    if (!resolvedUrl) return null;
    return imageCache.getCachedUrl(resolvedUrl) || resolvedUrl;
  });

  useEffect(() => {
    if (!resolvedUrl) { setDisplayUrl(null); return; }
    const cached = imageCache.getCachedUrl(resolvedUrl);
    if (cached) { setDisplayUrl(cached); return; }
    imageCache.loadImage(resolvedUrl)
      .then(blobUrl => setDisplayUrl(blobUrl))
      .catch(() => setDisplayUrl(resolvedUrl));
  }, [resolvedUrl]);

  const companyName = job.company_name || job.employer_profile?.company_name || job.profiles?.company_name || 'Okänt företag';
  const { text: timeText, isExpired } = getTimeRemaining(job.created_at, job.expires_at);
  const gradient = useMemo(() => getGradientForId(job.id), [job.id]);
  const initials = useMemo(() => getCompanyInitials(companyName), [companyName]);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved && onUnsaveClick) {
      onUnsaveClick(job.id, job.title);
    } else {
      doToggle(job.id);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteClick?.(job.id, job.title);
  };

  // Determine which action button to show
  const showDeleteButton = !!onDeleteClick;
  const showSaveButton = !hideSaveButton && !showDeleteButton;

  return (
    <Card 
      className="group bg-white/5 backdrop-blur-sm border-white/20 overflow-hidden cursor-pointer transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]"
      onClick={() => onCardClick ? onCardClick(job.id) : navigate(`/job-view/${job.id}`)}
    >
      {/* Visual header — image or gradient placeholder */}
      <div className="relative w-full h-40 overflow-hidden">
        {displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt={`${job.title} hos ${companyName}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        ) : (
          /* Gradient placeholder with company initials */
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 pb-6`}>
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <span className="text-xl font-bold text-white/50 tracking-wide">{initials}</span>
            </div>
          </div>
        )}
        
        {/* Action button — delete (trash) or save (heart) */}
        {showDeleteButton && (
          <button
            onClick={handleDeleteClick}
            aria-label="Ta bort ansökan"
            className="absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-destructive/40 bg-destructive/20 text-white transition-all duration-150 active:scale-90 md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
          >
            <Trash2 className="h-4 w-4 text-white" />
          </button>
        )}
        {showSaveButton && (
          <button
            onClick={handleSaveClick}
            aria-label={isSaved ? "Ta bort från sparade" : "Spara jobb"}
            className="absolute top-2.5 right-2.5 h-9 w-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/20 transition-all duration-150 active:scale-90"
          >
            <Heart className={`h-4 w-4 ${isSaved ? 'fill-red-400 text-red-400' : 'text-white'}`} />
          </button>
        )}

        {/* Views count badge — top-left when save button is hidden */}
        {hideSaveButton && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/15">
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
      <div className="p-3.5 space-y-2">
        {/* Title */}
        <TruncatedText
          text={job.title}
          className="text-[15px] font-bold text-white leading-snug line-clamp-2 text-center"
        />

        {/* Company + Location — glass badges, centered, truncation-safe */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap min-w-0">
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center max-w-[55%] overflow-hidden">
            <Building2 className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="leading-none truncate font-medium">{companyName}</span>
          </Badge>
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center max-w-[42%] overflow-hidden">
            <MapPin className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="leading-none truncate">{job.location}</span>
          </Badge>
        </div>

        {/* Tags row — badges restored, centered */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {job.employment_type && (
            <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none">
              {getEmploymentTypeLabel(job.employment_type)}
            </Badge>
          )}
          {!(isExpired && statusBadge) && (
            <Badge variant="glass" className={`text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center ${isExpired ? 'bg-red-500/20 text-red-300 border-red-500/30' : ''}`}>
              <Timer className="h-3 w-3 mr-0.5 flex-shrink-0" />
              <span className="leading-none">{isExpired ? 'Utgången' : `${timeText} kvar`}</span>
            </Badge>
          )}
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center">
            <Users className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="leading-none">{job.applications_count || 0} sökande</span>
          </Badge>
        </div>
        {footer && footer}
      </div>
    </Card>
  );
});

ReadOnlyMobileJobCard.displayName = 'ReadOnlyMobileJobCard';
