/**
 * Skeleton for JobDetails — matches JobDetailsHeader + kanban/mobile candidate view.
 * Uses unified `bg-white/10` shape tone. Sizes mirror the real layout so nothing
 * jumps when data arrives.
 */

const SHAPE = 'bg-white/10 animate-pulse';

export const JobDetailsSkeleton = () => (
  <div className="space-y-3 md:space-y-4 w-full px-2 md:px-0 py-3 md:py-4 pb-safe min-h-screen animate-fade-in md:max-w-[clamp(20rem,82vw,76rem)] md:mx-auto md:px-[clamp(0.75rem,2.5vw,2rem)]">
    {/* Header card */}
    <div className="rounded-lg border border-white/20 bg-white/5 p-3 md:p-4">
      {/* Title + close */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-2">
          <div className={`h-5 w-3/4 rounded ${SHAPE}`} />
          <div className={`h-5 w-1/2 rounded ${SHAPE}`} />
        </div>
        <div className={`h-7 w-7 rounded-full ${SHAPE}`} />
      </div>

      {/* Badge row: aktiv → plats → går ut */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <div className={`h-5 w-16 rounded-full ${SHAPE}`} />
        <div className={`h-4 w-28 rounded ${SHAPE}`} />
        <div className={`h-4 w-32 rounded ${SHAPE}`} />
      </div>

      {/* Stats grid — 3 cols mobile, 6 cols desktop */}
      <div className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`h-9 rounded-lg border border-white/20 bg-white/5 ${i >= 3 ? 'hidden md:block' : ''}`}
          />
        ))}
      </div>

      {/* Mobile action row (välj / visa / qr) */}
      <div className="mt-1.5 grid grid-cols-3 gap-1.5 md:hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-10 rounded-lg ${SHAPE}`} />
        ))}
      </div>
    </div>

    {/* Kanban columns (desktop) */}
    <div className="hidden md:flex gap-3 pt-2 overflow-hidden" style={{ height: 'calc(100vh - 300px)' }}>
      {[0, 1, 2, 3, 4].map((col) => (
        <div key={col} className="flex-1 min-w-[240px] flex flex-col gap-2">
          <div className={`h-8 rounded-md ${SHAPE}`} />
          <div className="flex-1 space-y-2 overflow-hidden">
            {col < 2 &&
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className={`h-20 rounded-md ${SHAPE}`} />
              ))}
          </div>
        </div>
      ))}
    </div>

    {/* Mobile candidate view — tabs + list */}
    <div className="md:hidden space-y-3">
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-8 flex-1 rounded-full ${SHAPE}`} />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`h-20 rounded-lg ${SHAPE}`} />
        ))}
      </div>
    </div>
  </div>
);
