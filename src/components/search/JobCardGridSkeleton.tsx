import { memo } from 'react';

/**
 * Inline (non-portal) job-card grid skeleton som matchar
 * ReadOnlyMobileJobCard exakt: bild 2:1, logo UNDER bilden (pt-1, w-14 h-14),
 * titel 2 rader centrerad, info-pills centrerade.
 *
 * Används inuti sidor som redan har sin egen header/title (t.ex. MyApplications,
 * SavedJobs) så vi inte får dubbla sidtitlar / dubbel chrome vid laddning.
 *
 * ENHETLIG TON: alla shape-element använder `bg-white/10 animate-pulse`
 * — samma standard som SearchPageSkeleton och EmployerPageSkeleton.
 */

const SHAPE = 'bg-white/10 animate-pulse';

interface Props {
  count: number;
}

export const JobCardGridSkeleton = memo(function JobCardGridSkeleton({ count }: Props) {
  // 0 träffar ⇒ inga placeholders. Skelettet ska aldrig låtsas att det finns
  // innehåll som inte finns — annars blinkar ett kort förbi på en tom lista.
  const safeCount = Math.max(0, Math.min(9, count));
  if (safeCount === 0) return null;
  return (
    <div
      className={`job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4${
        safeCount === 1 ? ' job-card-grid-single' : safeCount === 2 ? ' job-card-grid-double' : ''
      }`}
    >
      {Array.from({ length: safeCount }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden bg-white/[0.04]">
          {/* Bild — samma aspekt (2:1) som riktiga jobbkortet & hero */}
          <div className={`w-full ${SHAPE}`} style={{ aspectRatio: 'var(--job-media-aspect, 2 / 1)' }} />
          {/* Kortkropp — matchar ReadOnlyMobileJobCard exakt:
              logo UNDER bilden (pt-1), aldrig -mt-8/överhäng. */}
          <div className="p-4 space-y-2.5">
            <div className="flex justify-center pt-1">
              <div className={`h-14 w-14 rounded-full ${SHAPE}`} />
            </div>
            <div className="space-y-2 pt-1">
              <div className={`h-5 w-4/5 mx-auto rounded ${SHAPE}`} />
              <div className={`h-5 w-3/5 mx-auto rounded ${SHAPE}`} />
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <div className={`h-6 w-20 rounded-full ${SHAPE}`} />
              <div className={`h-6 w-24 rounded-full ${SHAPE}`} />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <div className={`h-6 w-28 rounded-full ${SHAPE}`} />
              <div className={`h-6 w-24 rounded-full ${SHAPE}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
