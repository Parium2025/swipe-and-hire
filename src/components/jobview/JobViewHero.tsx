import { memo, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, MapPin } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';

interface JobViewHeroProps {
  title: string;
  imageUrl: string | null;
  companyName: string;
  location?: string;
  employmentType?: string;
  positionsCount?: number;
  companyLogoUrl?: string | null;
}

const GRADIENTS = [
  'from-blue-900/40 via-indigo-900/30 to-slate-900/50',
  'from-indigo-900/40 via-blue-900/30 to-slate-900/50',
  'from-sky-900/40 via-blue-900/30 to-slate-900/50',
  'from-blue-900/40 via-sky-900/30 to-slate-900/50',
  'from-indigo-900/40 via-slate-900/30 to-blue-900/50',
  'from-cyan-900/40 via-blue-900/30 to-slate-900/50',
];

function getGradientForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
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

export const JobViewHero = memo(function JobViewHero({
  title,
  imageUrl,
  companyName,
  location,
  employmentType,
  positionsCount,
  companyLogoUrl,
}: JobViewHeroProps) {
  const positionsText = (positionsCount || 1) === 1 ? '1 ledig tjänst' : `${positionsCount} lediga tjänster`;
  const gradient = useMemo(() => getGradientForName(companyName), [companyName]);
  const initials = useMemo(() => getCompanyInitials(companyName), [companyName]);
  const hasLogo = !!companyLogoUrl;

  // Shared overlay content for both image and gradient fallback
  const overlayContent = (
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end text-center px-4 pb-4 sm:px-6 sm:pb-6">
      <TruncatedText
        text={title}
        className="text-white text-[15px] sm:text-xl md:text-2xl lg:text-3xl font-bold leading-snug sm:leading-tight max-w-4xl w-full text-center line-clamp-2 sm:line-clamp-3"
        tooltipSide="bottom"
      />
      
      {/* Mobile metadata */}
      <div className="mt-2 sm:hidden flex items-center justify-center gap-1.5 flex-wrap">
        {!hasLogo && (
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center text-white">
            <Building2 className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="truncate font-medium">{companyName}</span>
          </Badge>
        )}
        {location && (
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center text-white">
            <MapPin className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="truncate">{location}</span>
          </Badge>
        )}
      </div>

      {/* Mobile badges */}
      <div className="mt-1.5 sm:hidden flex items-center justify-center gap-1.5 flex-wrap">
        {employmentType && (
          <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none">
            {getEmploymentTypeLabel(employmentType)}
          </Badge>
        )}
        <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center">
          <Users className="h-3 w-3 mr-0.5 flex-shrink-0" />
          <span className="leading-none">{positionsText}</span>
        </Badge>
      </div>

      {/* Desktop/tablet metadata */}
      <div className="mt-4 hidden sm:flex flex-wrap items-center justify-center gap-2 text-sm md:text-base text-white">
        {employmentType && (
          <span className="text-white">{getEmploymentTypeLabel(employmentType).toUpperCase()}</span>
        )}
        {employmentType && location && (
          <span className="text-white/60">·</span>
        )}
        {location && (
          <span className="text-white">{location.toUpperCase()}</span>
        )}
        <span className="text-white/60">·</span>
        <span className="text-white">{positionsText}</span>
      </div>
    </div>
  );

  if (!imageUrl) {
    return (
      <div className="relative w-full h-64 md:h-80 overflow-hidden rounded-lg">
      <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 pb-16`}>
          {hasLogo ? (
            <>
              <div className="w-20 h-20 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                <img src={companyLogoUrl!} alt={companyName} className="w-full h-full object-cover" draggable={false} />
              </div>
              <Badge variant="glass" className="text-xs px-2.5 py-0.5 border-white/15 leading-none inline-flex items-center max-w-[80%] overflow-hidden">
                <Building2 className="h-3.5 w-3.5 mr-1 flex-shrink-0 text-white" />
                <span className="leading-none truncate font-medium text-white">{companyName}</span>
              </Badge>
            </>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <span className="text-3xl font-bold text-white/50 tracking-wide">{initials}</span>
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {overlayContent}
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 md:h-80 overflow-hidden rounded-lg">
      <img
        src={imageUrl}
        alt={`${title} hos ${companyName}`}
        className="w-full h-full object-cover"
        loading="eager"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      {overlayContent}
    </div>
  );
});
