import { memo, useMemo } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { Bookmark, Building2, Heart, X } from 'lucide-react';
import type { SwipeJob } from '../types';
import { Badge } from '@/components/ui/badge';
import { TruncatedText } from '@/components/TruncatedText';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { getJobOverlayTextStyle } from '@/lib/jobOverlayText';
import { getImageObjectPosition, getCompanyInitials } from './utils';
import { JobSlideBadgesRow } from './JobSlideBadgesRow';

interface NextCardUnderlayProps {
  job: SwipeJob;
  imageUrl: string | null;
  logoUrl: string | null;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  opacity: MotionValue<number>;
}

/**
 * Ghost-underlay: nästa jobbkort som ligger under det aktiva och glider
 * upp när användaren swipear vänster. Får ALDRIG rendera interaktiva
 * element (pointer-events-none på wrappern) — den är rent visuell.
 *
 * Innehållet är avsiktligt en spegel av det aktiva kortet så att
 * ingenting "blinkar" vid övergången. Skiljer sig från JobSlide-content:
 * - Ingen title/company tap-zone (inga data-attribut)
 * - Ingen titleRef, ingen onLoad, ingen onError
 * - Action-knapparna är dimmade placeholders (bg med /70 opacity)
 */
export const NextCardUnderlay = memo(function NextCardUnderlay({
  job,
  imageUrl,
  logoUrl,
  y,
  scale,
  opacity,
}: NextCardUnderlayProps) {
  const displayCompanyName = job.workplace_name || job.company_name || 'Okänt företag';
  const overlayTextStyle = useMemo(
    () => getJobOverlayTextStyle(job.overlay_text_color),
    [job.overlay_text_color],
  );

  return (
    <motion.div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl pointer-events-none"
      style={{ y, scale, opacity }}
    >
      {/* Bakgrundsbild */}
      <div className="absolute inset-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: getImageObjectPosition(job.image_focus_position) }}
            loading="eager"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)]" />
        )}
      </div>

      {/* Gradient — matchar aktivt kort exakt */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

      {/* Kategori-badge */}
      {job.occupation && (
        <div className="absolute top-5 left-5 z-10">
          <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md transform-gpu [will-change:transform]">
            <span className="text-xs font-semibold tracking-wide text-white">
              {job.occupation}
            </span>
          </div>
        </div>
      )}

      {/* Innehåll — identiskt med aktivt kort */}
      <div
        className="absolute inset-x-0 top-[20%] bottom-28 z-10 flex items-center justify-center px-6 text-center"
        style={overlayTextStyle}
      >
        <div className="mx-auto w-full max-w-[21rem]">
          {(!imageUrl || job.company_logo_url) && displayCompanyName && (
            <div className="flex justify-center mb-4">
              {job.company_logo_url ? (
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 backdrop-blur-md transform-gpu [will-change:transform] flex items-center justify-center overflow-hidden shadow-lg">
                  <img
                    src={logoUrl || ''}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-white/40 tracking-wide select-none">
                    {getCompanyInitials(displayCompanyName)}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-center">
            <Badge
              variant="glass"
              className="inline-flex max-w-[80%] min-w-0 items-center gap-1.5 border-white/15 px-3 py-1 text-white"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <TruncatedText
                text={displayCompanyName}
                className="min-w-0 flex-1 text-sm font-medium"
                tooltipSide="bottom"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              />
            </Badge>
          </div>

          <h3
            className="mt-1 line-clamp-2 text-[clamp(1.58rem,6.4vw,2.1rem)] font-extrabold leading-[1.08] tracking-tight text-white"
            style={overlayTextStyle}
          >
            {job.title}
          </h3>
          <p
            className="mt-2 truncate text-base font-semibold text-white"
            style={overlayTextStyle}
          >
            {[job.employment_type && getEmploymentTypeLabel(job.employment_type), job.location]
              .filter(Boolean)
              .join(' • ')}
          </p>

          <JobSlideBadgesRow job={job} blurClass="backdrop-blur-md" />
        </div>
      </div>

      {/* Ghost-actions (icke-interaktiva placeholders) */}
      <div className="absolute inset-x-0 bottom-4 z-10 px-5">
        <div className="mt-4 flex items-center justify-center gap-5">
          <div className="w-[52px] h-[52px] rounded-full bg-destructive/70 flex items-center justify-center shadow-lg">
            <X className="w-6 h-6 text-white/70" strokeWidth={2.5} />
          </div>
          <div className="w-[52px] h-[52px] rounded-full bg-secondary/70 border border-white/20 flex items-center justify-center shadow-lg">
            <Bookmark className="w-6 h-6 text-white/70" />
          </div>
          <div className="w-[52px] h-[52px] rounded-full bg-green-500/70 flex items-center justify-center shadow-lg">
            <Heart className="w-6 h-6 text-white/70 fill-white/70" />
          </div>
        </div>
      </div>
    </motion.div>
  );
});
