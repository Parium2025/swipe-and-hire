import { memo } from 'react';
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
}

export const JobViewHero = memo(function JobViewHero({
  title,
  imageUrl,
  companyName,
  location,
  employmentType,
  positionsCount,
}: JobViewHeroProps) {
  const positionsText = (positionsCount || 1) === 1 ? '1 ledig tjänst' : `${positionsCount} lediga tjänster`;

  if (!imageUrl) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
        <TruncatedText
          text={title}
          className="text-white text-xl md:text-2xl font-bold leading-tight line-clamp-3"
          tooltipSide="bottom"
        />
        <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-white">
          {employmentType && (
            <span>{getEmploymentTypeLabel(employmentType).toUpperCase()}</span>
          )}
          {location && (
            <>
              <span className="text-white/60">·</span>
              <span>{location.toUpperCase()}</span>
            </>
          )}
          <span className="text-white/60">·</span>
          <span>{positionsText}</span>
        </div>
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
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      
      {/* Text overlay */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end text-center px-4 pb-4 sm:px-6 sm:pb-6">
        <TruncatedText
          text={title}
          className="text-white text-[15px] sm:text-xl md:text-2xl lg:text-3xl font-bold leading-snug sm:leading-tight max-w-4xl w-full text-center line-clamp-2 sm:line-clamp-3"
          tooltipSide="bottom"
        />
        
        {/* Mobile metadata */}
        <div className="mt-2 sm:hidden flex items-center justify-center gap-1.5 text-[13px] text-white">
          <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-white" />
          <span className="truncate font-medium">{companyName}</span>
          {location && (
            <>
              <span className="text-white/30">·</span>
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-white" />
              <span className="truncate">{location}</span>
            </>
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
    </div>
  );
});
