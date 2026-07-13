import { memo, useEffect, useMemo } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import type { SwipeJob } from '../types';
import { getJobOverlayTextStyle } from '@/lib/jobOverlayText';
import { getImageObjectPosition } from './utils';
import { JobSlideContent, OccupationBadge } from './JobSlideContent';
import { useCardImage } from '@/hooks/useCardImage';
import { getImageVersion } from '@/lib/imageTransforms';
import { SWIPE_IMG_TRANSFORM, SWIPE_LOGO_TRANSFORM } from './constants';

interface NextCardUnderlayProps {
  job: SwipeJob;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  opacity: MotionValue<number>;
}

/**
 * Ghost-underlay: nästa jobbkort som ligger under det aktiva och glider
 * upp när användaren swipear vänster. Får ALDRIG rendera interaktiva
 * element (pointer-events-none på wrappern) — den är rent visuell.
 *
 * Bild-/logo-hooks bor HÄR (inte i JobSlide) så att inaktiva kort inte
 * betalar för `useCardImage` × 2 utan anledning. Underlaget monteras
 * bara för det aktiva kortet (via JobSlide) → exakt ett par extra
 * image-hooks totalt istället för ett par per monterat kort.
 *
 * Innehåll delas med JobSlide via `JobSlideContent` för att garantera
 * pixelperfekt paritet — annars "hoppar" innehållet vid övergången.
 */
export const NextCardUnderlay = memo(function NextCardUnderlay({
  job,
  y,
  scale,
  opacity,
}: NextCardUnderlayProps) {
  const displayCompanyName = job.workplace_name || job.company_name || 'Okänt företag';
  const overlayTextStyle = useMemo(
    () => getJobOverlayTextStyle(job.overlay_text_color),
    [job.overlay_text_color],
  );

  // KRITISKT: getImageVersion måste matcha useSwipeImagePreloader exakt,
  // annars warmar preloadern en URL och kortet renderar en annan → cache-
  // miss + synlig nätverksladdning på första frame.
  const { displayUrl: imageUrl } = useCardImage(
    job.job_image_url ?? null,
    'job-images',
    getImageVersion(job),
    SWIPE_IMG_TRANSFORM,
  );
  const { displayUrl: logoUrl } = useCardImage(
    job.company_logo_url ?? null,
    'company-logos',
    getImageVersion(job),
    SWIPE_LOGO_TRANSFORM,
  );

  // 🚀 Proaktiv decode: när underlaget mountas har vi bilden redan i cache
  // (preloader) men bitmapen är inte alltid dekodad. `img.decode()` gör
  // det off-main-thread så första frame när kortet blir aktivt är utan
  // hicka. Ignorera fel — bilden dyker upp ändå via normal load-path.
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.src = imageUrl;
    img.decode?.().catch(() => { /* decode() rejects om src ändras */ });
  }, [imageUrl]);

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
      {/* Bakgrundsbild */}
      <div className="absolute inset-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: getImageObjectPosition(job.image_focus_position) }}
            loading="eager"
            decoding="async"
            {...({ fetchPriority: 'high' } as Record<string, string>)}
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
