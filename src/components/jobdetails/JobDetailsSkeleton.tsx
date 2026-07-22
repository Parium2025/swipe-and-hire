/**
 * Skeleton for JobDetails — matches JobDetailsHeader + kanban/mobile candidate view
 * pixel-for-pixel. Same wrapper spacing, same column widths (clamp(200px,22vw,260px)),
 * same mobile action row, same mobile tab-pill list, same kanban height and pb-4.
 * Uses unified `bg-white/10` shape tone. Nothing shifts when data arrives.
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
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        <div className={`h-5 w-16 rounded-full ${SHAPE}`} />
        <div className={`h-4 w-28 rounded ${SHAPE}`} />
        <div className={`h-4 w-32 rounded ${SHAPE}`} />
      </div>

      {/* Stats grid — 3 cols mobile, 6 cols desktop; items 3-5 are hidden on mobile */}
      <div className="mt-3 space-y-1.5 md:space-y-0">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-[30px] rounded-lg border border-white/20 bg-white/5 ${i >= 3 ? 'hidden md:block' : ''}`}
            />
          ))}
        </div>

        {/* Mobile action row: välj / visa / qr */}
        <div className="grid grid-cols-3 gap-1.5 md:hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-[42px] rounded-lg ${SHAPE}`} />
          ))}
        </div>
      </div>
    </div>

    {/* Kanban columns (desktop) — matches real width clamp(200px,22vw,260px) and pb-4 */}
    <div
      className="hidden md:flex gap-3 pb-4 pt-2 overflow-hidden"
      style={{ height: 'calc(100vh - 300px)' }}
    >
      {[0, 1, 2, 3, 4].map((col) => (
        <div
          key={col}
          className="flex-shrink-0 flex flex-col h-full"
          style={{ width: 'clamp(200px, 22vw, 260px)' }}
        >
          {/* Column header pill */}
          <div className="rounded-md px-2 py-1.5 mb-2 ring-1 ring-inset ring-white/20 flex items-center gap-2">
            <div className={`h-3.5 w-3.5 rounded ${SHAPE}`} />
            <div className={`h-3 flex-1 rounded ${SHAPE}`} />
            <div className={`h-4 w-5 rounded-full ${SHAPE}`} />
          </div>
          {/* Column body */}
          <div className="flex-1 space-y-2 overflow-hidden">
            {col < 2 &&
              Array.from({ length: col === 0 ? 3 : 1 }).map((_, i) => (
                <div key={i} className={`h-[92px] rounded-md ${SHAPE}`} />
              ))}
          </div>
        </div>
      ))}
      {/* "Nytt steg" chip */}
      <div className="flex-shrink-0 flex items-start pt-1">
        <div className={`h-7 w-24 rounded-full ${SHAPE}`} />
      </div>
    </div>

    {/* Mobile candidate view — tab pills + list */}
    <div className="md:hidden space-y-3">
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-8 flex-1 rounded-full ${SHAPE}`} />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-24 rounded-lg ${SHAPE}`} />
        ))}
      </div>
    </div>
  </div>
);
