import { memo, useMemo } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import type { SwipeJob } from '../types';
import { getJobOverlayTextStyle } from '@/lib/jobOverlayText';
import { getImageObjectPosition } from './utils';
import { JobSlideContent, OccupationBadge } from './JobSlideContent';

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
 * Innehåll delas med JobSlide via `JobSlideContent` för att garantera
 * pixelperfekt paritet — annars "hoppar" innehållet vid övergången.
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
      // Ingen border här — en 1px white/10-ram syns som ett vitt "rim" när
      // underlaget är fullt synligt precis innan det nya kortet mountas
      // (särskilt på iOS Safari). Solid mörk bas så inget lyser igenom om
      // bilden inte hunnit dekodas till första paint.
      className="absolute inset-0 overflow-hidden rounded-2xl bg-[hsl(215,85%,15%)] shadow-2xl pointer-events-none"
      style={{ y, scale, opacity }}
    >
      {/* Bakgrundsbild — decoding="async" så dekoderingen sker off-thread
          och aldrig blockar fade-in-framen (annars syns ett "blink" när GPU
          måste dekoda + composita samma frame). Bilden är redan varm i
          blob-cachen via useSwipeImagePreloader innan underlaget mountas. */}
      <div className="absolute inset-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: getImageObjectPosition(job.image_focus_position) }}
            loading="eager"
            decoding="async"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)]" />
        )}
      </div>

      {/* Gradient — matchar aktivt kort exakt */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

      {job.occupation && <OccupationBadge occupation={job.occupation} />}

      <JobSlideContent
        job={job}
        logoUrl={logoUrl}
        hasImage={Boolean(imageUrl)}
        displayCompanyName={displayCompanyName}
        overlayTextStyle={overlayTextStyle}
      />
    </motion.div>
  );
});
