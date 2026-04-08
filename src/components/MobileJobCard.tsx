import { memo, useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Users, Edit, Trash2 } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { formatDateShortSv, getTimeRemaining } from '@/lib/date';
import { isEmployerJobDraft, isEmployerJobExpired } from '@/lib/jobStatus';
import { supabase } from '@/integrations/supabase/client';
import { imageCache } from '@/lib/imageCache';
import type { JobPosting } from '@/hooks/useJobsData';

interface MobileJobCardProps {
  job: JobPosting;
  onEdit: (job: JobPosting) => void;
  onDelete: (job: JobPosting) => void;
  onEditDraft?: (job: JobPosting) => void;
  onPrefetch?: (jobId: string) => void;
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

export const MobileJobCard = memo(({ job, onEdit, onDelete, onEditDraft, onPrefetch }: MobileJobCardProps) => {
  const navigate = useNavigate();
  const isDraft = isEmployerJobDraft(job);
  const isExpired = isEmployerJobExpired(job);
  const timeInfo = getTimeRemaining(job.created_at, job.expires_at);
  const companyName = job.employer_profile?.company_name || 'Okänt företag';
  const recruiterName = job.employer_profile?.first_name && job.employer_profile?.last_name
    ? `${job.employer_profile.first_name} ${job.employer_profile.last_name}`
    : null;

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
    if (!resolvedUrl || cachedBlobUrl) {
      setLoadedBlobUrl(null);
      return;
    }
    let cancelled = false;
    imageCache.loadImage(resolvedUrl)
      .then(blobUrl => {
        if (!cancelled) setLoadedBlobUrl(blobUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resolvedUrl, cachedBlobUrl]);

  const displayUrl = cachedBlobUrl || loadedBlobUrl || resolvedUrl;
  const gradient = useMemo(() => getGradientForId(job.id), [job.id]);
  const initials = useMemo(() => getCompanyInitials(companyName), [companyName]);
  const rawLogoUrl = useMemo(() => {
    const url = job.employer_profile?.company_logo_url;
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return supabase.storage.from('company-logos').getPublicUrl(url).data?.publicUrl || null;
  }, [job.employer_profile?.company_logo_url]);
  const cachedLogoBlob = useMemo(() => rawLogoUrl ? imageCache.getCachedUrl(rawLogoUrl) : null, [rawLogoUrl]);
  const [loadedLogoBlob, setLoadedLogoBlob] = useState<string | null>(null);
  useEffect(() => {
    if (!rawLogoUrl || cachedLogoBlob) { setLoadedLogoBlob(null); return; }
    let cancelled = false;
    imageCache.loadImage(rawLogoUrl).then(b => { if (!cancelled) setLoadedLogoBlob(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [rawLogoUrl, cachedLogoBlob]);
  const logoUrl = cachedLogoBlob || loadedLogoBlob || rawLogoUrl;

  const handleCardClick = () => {
    if (isDraft && onEditDraft) {
      onEditDraft(job);
      return;
    }
    navigate(`/job-details/${job.id}`);
  };

  const handleTouchStart = () => {
    if (!isDraft && !isExpired && onPrefetch) {
      onPrefetch(job.id);
    }
  };

  const hoverClass = isExpired
    ? '[@media(hover:hover)]:hover:bg-red-500/10 [@media(hover:hover)]:hover:border-red-500/30 active:bg-red-500/15'
    : isDraft
      ? '[@media(hover:hover)]:hover:bg-amber-500/10 [@media(hover:hover)]:hover:border-amber-500/30 active:bg-amber-500/15'
      : '[@media(hover:hover)]:hover:bg-green-500/10 [@media(hover:hover)]:hover:border-green-500/30 active:bg-green-500/15';

  return (
    <Card
      className={`job-card-mobile-shell group bg-white/5 border-white/20 overflow-hidden cursor-pointer transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] ${hoverClass}`}
      style={{ contain: 'layout style paint', contentVisibility: 'auto', containIntrinsicSize: 'auto 420px' } as React.CSSProperties}
      onClick={handleCardClick}
      onTouchStart={handleTouchStart}
    >
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
            {logoUrl ? (
              <>
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                  <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" draggable={false} />
                </div>
                <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center max-w-[80%] overflow-hidden">
                  <Building2 className="h-3 w-3 mr-0.5 flex-shrink-0 text-white" />
                  <span className="leading-none truncate font-medium text-white">{companyName}</span>
                </Badge>
              </>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                <span className="text-xl font-bold text-white/50 tracking-wide">{initials}</span>
              </div>
            )}
          </div>
        )}

        <div className="absolute top-2.5 left-2.5">
          {isExpired ? (
            <Badge variant="glassDestructive" className="text-[11px] px-2 py-0.5">
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

      <div className="job-card-mobile-body flex h-full flex-col gap-0.5 py-0.5">
        <div className="flex min-h-[clamp(4.25rem,3.8rem+1.6vw,5.25rem)] items-start justify-center px-2">
          <TruncatedText
            text={job.title}
            className="w-full text-center text-[clamp(1.02rem,0.98rem+0.18vw,1.12rem)] font-bold leading-[1.32] text-white line-clamp-2"
          />
        </div>

        <div className="h-px bg-white/10 mx-2" />

        <div className="space-y-2 px-2 pb-1">
          <div className="flex items-center justify-between">
            <span className="text-sm leading-none text-white">Anställningsform</span>
            <span className="text-sm leading-none text-white font-medium text-right">{job.employment_type ? getEmploymentTypeLabel(job.employment_type) : '–'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm leading-none text-white">Ansökningar</span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm leading-none text-white font-medium">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              {job.applications_count || 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm leading-none text-white">Plats</span>
            <span className="max-w-[56%] truncate text-right text-sm leading-none text-white font-medium">{job.location || '–'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm leading-none text-white">Rekryterare</span>
            <span className="max-w-[56%] truncate text-right text-sm leading-none text-white font-medium">{recruiterName || '–'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm leading-none text-white">Publicerad</span>
            <span className="text-sm leading-none text-white font-medium text-right">{formatDateShortSv(job.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm leading-none text-white">Status</span>
            <span className={`text-sm leading-none font-medium ${isExpired ? 'text-red-300' : isDraft ? 'text-amber-300' : 'text-white'}`}>
              {isExpired ? 'Utgången' : isDraft ? 'Utkast' : `${timeInfo.text} kvar`}
            </span>
          </div>
        </div>

        <div className="h-px bg-white/10 mx-2" />

        <div className={`flex gap-2 px-2 py-1.5 ${isExpired ? 'justify-center' : ''}`}>
          {!isExpired && (
            <Button
              variant="glass"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (isDraft && onEditDraft) {
                  onEditDraft(job);
                } else {
                  onEdit(job);
                }
              }}
              className="flex-1 h-11 text-sm transition-[background-color,border-color] duration-150 hover:bg-blue-500/20 hover:border-blue-500/40"
            >
              <Edit className="h-4 w-4 mr-2" />
              Redigera
            </Button>
          )}
          <Button
            variant="glass"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(job);
            }}
            className={`${isExpired ? 'px-8' : 'flex-1'} h-11 rounded-full border-destructive/40 bg-destructive/20 text-white transition-[background-color,border-color,color,transform] duration-150 md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white active:scale-[0.97]`}
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
