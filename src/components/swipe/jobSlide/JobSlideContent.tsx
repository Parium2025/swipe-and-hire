import { memo, type CSSProperties, type Ref } from 'react';
import { Building2 } from 'lucide-react';
import type { SwipeJob } from '../types';
import { Badge } from '@/components/ui/badge';
import { TruncatedText } from '@/components/TruncatedText';
import { getEmploymentTypeLabel, formatEmploymentDetails } from '@/lib/employmentTypes';
import { getCompanyInitials } from './utils';
import { JobSlideBadgesRow } from './JobSlideBadgesRow';

interface JobSlideContentProps {
  job: SwipeJob;
  logoUrl: string | null;
  hasImage: boolean;
  displayCompanyName: string;
  overlayTextStyle: CSSProperties;
  /**
   * Aktivt kort → skickar in titleRef + data-attribut för tap-hint.
   * Ghost/underlay → inget av det (rent visuell spegel).
   */
  interactive?: boolean;
  titleRef?: Ref<HTMLHeadingElement>;
  onLogoError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Delad hero-block: logo + företag + titel + plats/anställning + badges.
 * Renderas identiskt av både JobSlide (aktivt kort) och NextCardUnderlay
 * (ghost) — enda skillnaden är tap-zon-attribut och titleRef.
 *
 * VIKTIGT: Ändras layouten här måste den se identisk ut i båda lägena,
 * annars "hoppar" innehållet när användaren swipear.
 */
export const JobSlideContent = memo(function JobSlideContent({
  job,
  logoUrl,
  hasImage,
  displayCompanyName,
  overlayTextStyle,
  interactive,
  titleRef,
  onLogoError,
}: JobSlideContentProps) {
  return (
    <div
      className="absolute inset-x-0 top-[20%] bottom-28 z-10 flex items-center justify-center px-6 text-center"
      style={overlayTextStyle}
    >
      <div className="mx-auto w-full max-w-[21rem]">
        {(logoUrl || !hasImage) && displayCompanyName && (
          <div
            className="flex justify-center mb-4"
            {...(interactive ? { 'data-company-tap-zone': '' } : {})}
          >
            {logoUrl ? (
              <div className="w-14 h-14 rounded-full bg-[hsl(215,85%,15%)] border border-white/10 flex items-center justify-center overflow-hidden shadow-lg active:scale-95 transition-transform">
                <img
                  src={logoUrl}
                  alt={interactive ? displayCompanyName : ''}
                  className="w-full h-full object-cover"
                  draggable={false}
                  onError={onLogoError}
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-white/10 border border-white/10 flex items-center justify-center active:scale-95 transition-transform">
                <span className="text-xl font-bold text-white/40 tracking-wide select-none">
                  {getCompanyInitials(displayCompanyName)}
                </span>
              </div>
            )}
          </div>
        )}

        <div
          className="flex justify-center"
          {...(interactive ? { 'data-company-tap-zone': '' } : {})}
        >
          <div className="inline-flex max-w-[80%] min-w-0 items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/45 border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-white" />
            <TruncatedText
              text={displayCompanyName}
              className="min-w-0 flex-1 text-xs font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]"
              tooltipSide="bottom"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            />
          </div>
        </div>


        <h2
          ref={titleRef}
          {...(interactive ? { 'data-title-tap-zone': '' } : {})}
          className="mt-1 text-[clamp(1.58rem,6.4vw,2.1rem)] font-extrabold text-white leading-[1.16] tracking-tight line-clamp-2 pb-[0.14em]"
          style={overlayTextStyle}
        >
          {job.title}
        </h2>
        {(() => {
          const label = job.employment_type ? getEmploymentTypeLabel(job.employment_type) : '';
          const detail = formatEmploymentDetails({
            employment_type: job.employment_type,
            duration_amount: job.duration_amount,
            duration_unit: job.duration_unit,
            part_time_days: job.part_time_days,
            part_time_shifts: job.part_time_shifts,
          });
          const employmentPart = [label, detail].filter(Boolean).join(' · ');
          // När vi har både anställningstyp-detaljer OCH ort → två rader
          // så inget trunkeras (t.ex. Deltid · Mån–Sön · Dag, Kväll, Natt).
          const twoLines = Boolean(employmentPart && job.location);
          if (twoLines) {
            return (
              <div className="mt-2 space-y-0.5" style={overlayTextStyle}>
                <p className="text-white font-semibold text-[15px] leading-snug line-clamp-2 [text-wrap:balance]">
                  {employmentPart}
                </p>
                <p className="text-white/95 font-medium text-sm leading-snug truncate">
                  {job.location}
                </p>
              </div>
            );
          }
          const single = [employmentPart, job.location].filter(Boolean).join(' • ');
          return (
            <p
              className="text-white font-semibold text-base mt-2 line-clamp-2 [text-wrap:balance]"
              style={overlayTextStyle}
            >
              {single}
            </p>
          );
        })()}

        <JobSlideBadgesRow job={job} />
      </div>
    </div>
  );
});

interface OccupationBadgeProps {
  occupation: string;
}

/**
 * Solid mörk chip längst upp till vänster. Ingen backdrop-blur — det
 * orsakade synligt flimmer varje gång underliggande bild/animation
 * ändrades (filter måste re-samplas per frame). bg-black/45 + text-shadow
 * ger samma premium-läsbarhet utan resampling.
 */
export const OccupationBadge = memo(function OccupationBadge({
  occupation,
}: OccupationBadgeProps) {
  return (
    <div className="absolute top-5 left-5 z-10 pointer-events-none">
      <div className="px-3 py-1.5 rounded-full bg-black/45 border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <span className="text-white text-xs font-semibold tracking-wide [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
          {occupation}
        </span>
      </div>
    </div>
  );
});
