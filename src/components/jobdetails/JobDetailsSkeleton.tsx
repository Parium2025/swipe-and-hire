/**
 * Skeleton loader for JobDetails page.
 * Mirrors the real layout exakt: header card (titel/plats/status/stat-pills)
 * + kanban-kolumner. Läser cachead layout per jobb (`parium:jobDetails:{jobId}:layout`)
 * så skelett-korten i varje kolumn matchar precis hur många ansökningar som
 * faktiskt finns i den aktuella annonsen — inga spökkort från en annan annons.
 * Unified shape tone: `bg-white/10`.
 */

const SHAPE = 'bg-white/10 animate-pulse rounded';

interface JobDetailsSkeletonProps {
  jobId?: string;
}

interface CachedLayout {
  stages: string[];
  labels: Record<string, string>;
  counts: Record<string, number>;
}

function readLayout(jobId?: string): CachedLayout | null {
  if (!jobId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`parium:jobDetails:${jobId}:layout`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.stages)) return null;
    return parsed as CachedLayout;
  } catch {
    return null;
  }
}

function readActiveStage(jobId?: string): string | null {
  if (!jobId || typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`parium:jobDetails:${jobId}:activeStage`);
  } catch {
    return null;
  }
}

export const JobDetailsSkeleton = ({ jobId }: JobDetailsSkeletonProps = {}) => {
  const layout = readLayout(jobId);
  const stages = layout?.stages ?? ['s1', 's2', 's3', 's4', 's5'];
  const counts = layout?.counts ?? {};
  // Clamp per kolumn så vi aldrig ritar tusen kort — men speglar verklig data.
  const cardsFor = (stage: string) => Math.min(20, Math.max(0, counts[stage] ?? 0));

  // Mobile: single big column-box representing the currently active tab.
  const activeStage = readActiveStage(jobId) ?? stages[0];
  const mobileCount = cardsFor(activeStage);

  const CandidateRowSkeleton = () => (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`h-9 w-9 rounded-full ${SHAPE}`} />
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className={`h-3.5 w-28 ${SHAPE}`} />
          <div className={`h-2.5 w-20 ${SHAPE}`} />
        </div>
      </div>
      <div className={`h-2.5 w-16 ${SHAPE}`} />
    </div>
  );

  return (
    <div className="responsive-container-wide py-4 pb-safe min-h-screen space-y-4">
      {/* Header card — matches JobDetailsHeader */}
      <div className="rounded-lg border border-white/20 bg-white/5 p-3 md:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={`h-6 w-3/4 ${SHAPE}`} />
          <div className={`h-7 w-7 rounded-full ${SHAPE}`} />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <div className={`h-5 w-16 rounded-full ${SHAPE}`} />
          <div className={`h-4 w-32 ${SHAPE}`} />
          <div className={`h-3 w-28 ${SHAPE}`} />
        </div>

        <div className="mt-3 space-y-1.5 md:space-y-0">
          <div className="hidden md:grid grid-cols-6 gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`h-8 ${SHAPE} border border-white/10`} />
            ))}
          </div>
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

      {/* Mobile / tablet (<lg): tab-strip + one big column-box for active stage */}
      <div className="lg:hidden flex flex-col gap-3">
        {/* Horizontal stage tabs */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {stages.map((stage, i) => (
            <div
              key={stage + i}
              className={`h-7 shrink-0 rounded-md ${SHAPE}`}
              style={{ width: i === 0 ? 120 : 96 }}
            />
          ))}
        </div>
        {/* Single column-box — mirrors MobileCandidateView list container */}
        <div className="rounded-lg border border-white/20 bg-white/5 p-2 min-h-[50vh]">
          {mobileCount === 0 ? (
            <div className="h-full min-h-[40vh] flex items-center justify-center">
              <div className={`h-3 w-40 ${SHAPE}`} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: mobileCount }).map((_, k) => (
                <CandidateRowSkeleton key={k} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop (lg+): kanban board — per-stage kortantal från cache */}
      <div className="hidden lg:flex gap-3 overflow-x-auto pb-4 px-1">
        {stages.map((stage, i) => {
          const count = cardsFor(stage);
          return (
            <div key={stage + i} className="flex-1 min-w-[260px] max-w-[320px] flex flex-col">
              {/* Column header */}
              <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`h-4 w-4 rounded-full ${SHAPE} shrink-0`} />
                  <div className={`h-4 w-24 ${SHAPE}`} />
                </div>
                <div className={`h-4 w-6 ${SHAPE}`} />
              </div>
              {/* Cards — exakt antal per kolumn */}
              <div className="space-y-2">
                {count === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center">
                    <div className={`h-3 w-32 mx-auto ${SHAPE}`} />
                  </div>
                ) : (
                  Array.from({ length: count }).map((_, k) => (
                    <CandidateRowSkeleton key={k} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
