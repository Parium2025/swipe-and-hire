import { memo, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, MapPin, Timer, Gift, Briefcase, Banknote } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { getTimeRemaining } from '@/lib/date';
import { getJobOverlayTextStyle } from '@/lib/jobOverlayText';
import { ResilientImage } from '@/components/ui/ResilientImage';
import { getCompanyInitials } from '@/lib/companyInitials';
import { toObjectPosition } from '@/lib/jobImageFocus';

interface JobViewHeroProps {
  title: string;
  imageUrl: string | null;
  companyName: string;
  location?: string;
  employmentType?: string;
  positionsCount?: number;
  companyLogoUrl?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryType?: string | null;
  salaryTransparency?: string | null;
  benefits?: string[] | null;
  createdAt?: string;
  expiresAt?: string | null;
  overlayTextColor?: string | null;
  imageFocusPosition?: string | null;
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


function getSalaryText(salaryMin?: number | null, salaryMax?: number | null, salaryType?: string | null, salaryTransparency?: string | null): string | null {
  const typeLabel = salaryType === 'monthly' || salaryType === 'fast' ? 'kr/mån'
    : salaryType === 'hourly' || salaryType === 'rorlig' ? 'kr/tim'
    : salaryType === 'fast-rorlig' ? 'kr/mån' : 'kr/mån';

  if (salaryTransparency === 'after_interview') return 'Lön efter intervju';
  if (salaryMin || salaryMax) {
    if (salaryMin && salaryMax) {
      return `${salaryMin.toLocaleString('sv-SE')} – ${salaryMax.toLocaleString('sv-SE')} ${typeLabel}`;
    }
    return `Från ${(salaryMin || salaryMax)!.toLocaleString('sv-SE')} ${typeLabel}`;
  }
  if (salaryTransparency && /^\d/.test(salaryTransparency)) {
    const match = salaryTransparency.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (match) {
      return `${parseInt(match[1], 10).toLocaleString('sv-SE')} – ${parseInt(match[2], 10).toLocaleString('sv-SE')} ${typeLabel}`;
    }
    return `${salaryTransparency} ${typeLabel}`;
  }
  return null;
}

export const JobViewHero = memo(function JobViewHero({
  title,
  imageUrl,
  companyName,
  location,
  employmentType,
  positionsCount,
  companyLogoUrl,
  salaryMin,
  salaryMax,
  salaryType,
  salaryTransparency,
  benefits,
  createdAt,
  expiresAt,
  overlayTextColor,
  imageFocusPosition,
}: JobViewHeroProps) {
  const positionsText = (positionsCount || 1) === 1 ? '1 ledig tjänst' : `${positionsCount} lediga tjänster`;
  const gradient = useMemo(() => getGradientForName(companyName), [companyName]);
  const initials = useMemo(() => getCompanyInitials(companyName), [companyName]);
  const hasLogo = !!companyLogoUrl;
  const hasImage = !!imageUrl;
  const salaryText = useMemo(() => getSalaryText(salaryMin, salaryMax, salaryType, salaryTransparency), [salaryMin, salaryMax, salaryType, salaryTransparency]);
  const timeInfo = useMemo(() => createdAt ? getTimeRemaining(createdAt, expiresAt ?? undefined) : null, [createdAt, expiresAt]);
  const overlayTextStyle = useMemo(() => getJobOverlayTextStyle(overlayTextColor), [overlayTextColor]);
  const objectPosition = useMemo(() => toObjectPosition(imageFocusPosition), [imageFocusPosition]);

  // Ren bild/gradient utan overlay-titel — titeln flyttad till egen sektion
  // under hero för att matcha arbetsgivar-preview och undvika text ovanpå bild.
  const overlayContent = null;

  if (!imageUrl) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: 'var(--job-media-aspect, 2 / 1)' }}>
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {overlayContent}
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[2/1] overflow-hidden rounded-lg">
      <ResilientImage
        src={imageUrl}
        alt={`${title} hos ${companyName}`}
        className="w-full h-full object-cover"
        style={{ objectPosition }}
        loading="eager"
        fetchPriority="high"
        decoding="sync"
        fallbackClassName="w-full h-full"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      {overlayContent}
    </div>
  );
});
