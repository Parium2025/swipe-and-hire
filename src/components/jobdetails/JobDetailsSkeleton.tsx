/**
 * Skeleton loader for JobDetails page.
 * Mirrors the real layout: header card (title/location/stat-pills) + kanban columns.
 * Unified shape tone: `bg-white/10` — inga blandade opaciteter.
 */

const SHAPE = 'bg-white/10 animate-pulse rounded';

export const JobDetailsSkeleton = () => (
  <div className="responsive-container-wide py-4 pb-safe min-h-screen animate-fade-in space-y-4">
    {/* Header card — matches JobDetailsHeader */}
    <div className="rounded-lg border border-white/20 bg-white/5 p-3 md:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className={`h-6 w-3/4 ${SHAPE}`} />
        <div className={`h-7 w-7 rounded-full ${SHAPE}`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <div className={`h-4 w-32 ${SHAPE}`} />
        <div className={`h-5 w-16 rounded-full ${SHAPE}`} />
        <div className={`h-3 w-28 ${SHAPE}`} />
      </div>

      <div className="mt-3 space-y-1.5 md:space-y-0">
        {/* Desktop: 6 pills */}
        <div className="hidden md:grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-8 ${SHAPE} border border-white/10`} />
          ))}
        </div>
        {/* Mobile: 3 stat pills + 3 action pills */}
        <div className="md:hidden grid grid-cols-3 gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`h-8 ${SHAPE} border border-white/10`} />
          ))}
        </div>
        <div className="md:hidden grid grid-cols-3 gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`h-11 ${SHAPE} border border-white/10`} />
          ))}
        </div>
      </div>
    </div>

    {/* Kanban board */}
    <div className="flex gap-3 overflow-x-auto pb-4 px-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-1 min-w-[260px] max-w-[320px] flex flex-col">
          {/* Column header */}
          <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-4 w-4 rounded-full ${SHAPE}`} />
              <div className={`h-4 w-24 ${SHAPE}`} />
            </div>
            <div className={`h-4 w-6 ${SHAPE}`} />
          </div>
          {/* Cards */}
          <div className="space-y-2">
            {i === 0 && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`h-9 w-9 rounded-full ${SHAPE}`} />
                  <div className="flex-1 space-y-1.5">
                    <div className={`h-3.5 w-28 ${SHAPE}`} />
                    <div className={`h-2.5 w-20 ${SHAPE}`} />
                  </div>
                </div>
                <div className={`h-2.5 w-16 ${SHAPE}`} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);
