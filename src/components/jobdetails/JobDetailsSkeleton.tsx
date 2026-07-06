/**
 * Skeleton loader for JobDetails page.
 * Unified color standard: every placeholder shape uses `bg-white/10`
 * (same tone as the logo-circle skeleton) — no mixed opacities, no borders.
 */

const SHAPE = 'bg-white/10 animate-pulse';

export const JobDetailsSkeleton = () => (
  <div className="space-y-4 responsive-container-wide py-4 pb-safe min-h-screen animate-fade-in">
    <div className="rounded-lg p-3 md:p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-4 space-y-2">
          <div className={`h-6 w-3/4 rounded ${SHAPE}`} />
          <div className="flex items-center gap-4">
            <div className={`h-4 w-24 rounded ${SHAPE}`} />
            <div className={`h-5 w-16 rounded-full ${SHAPE}`} />
          </div>
        </div>
        <div className={`h-8 w-8 rounded ${SHAPE}`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {[1, 2].map(i => (
          <div key={i} className="rounded-lg p-2 md:p-3 space-y-2">
            <div className={`h-4 w-20 rounded ${SHAPE}`} />
            <div className={`h-6 w-8 rounded ${SHAPE}`} />
          </div>
        ))}
      </div>
    </div>
    <div className="rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className={`h-4 w-32 rounded ${SHAPE}`} />
        <div className={`h-6 w-20 rounded ${SHAPE}`} />
      </div>
    </div>
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex-1 min-w-[160px] max-w-[240px] flex flex-col">
          <div className={`rounded-md px-2 py-1.5 mb-2 ${SHAPE}`}>
            <div className="h-4 w-24 rounded bg-white/10" />
          </div>
          <div className="flex-1 space-y-2 p-1">
            {i <= 2 && (
              <div className={`rounded-md p-2 space-y-2 ${SHAPE}`}>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-20 rounded bg-white/10" />
                    <div className="h-2 w-12 rounded bg-white/10" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);
