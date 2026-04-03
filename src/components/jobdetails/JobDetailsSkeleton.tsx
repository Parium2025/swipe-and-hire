/**
 * Skeleton loader for JobDetails page.
 * Extracted to reduce main file complexity and allow independent optimization.
 */
export const JobDetailsSkeleton = () => (
  <div className="space-y-4 responsive-container-wide py-4 pb-safe min-h-screen animate-fade-in">
    <div className="bg-white/5 border border-white/20 rounded-lg p-3 md:p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-4 space-y-2">
          <div className="h-6 w-3/4 bg-white/10 rounded animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
            <div className="h-5 w-16 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-8 bg-white/5 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {[1, 2].map(i => (
          <div key={i} className="bg-white/5 rounded-lg p-2 md:p-3 space-y-2">
            <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
            <div className="h-6 w-8 bg-white/10 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
        <div className="h-6 w-20 bg-white/10 rounded animate-pulse" />
      </div>
    </div>
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex-1 min-w-[160px] max-w-[240px] flex flex-col">
          <div className="rounded-md px-2 py-1.5 mb-2 bg-white/10 animate-pulse">
            <div className="h-4 w-24 bg-white/20 rounded" />
          </div>
          <div className="flex-1 space-y-2 p-1">
            {i <= 2 && (
              <div className="bg-white/5 rounded-md p-2 space-y-2 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-20 bg-white/10 rounded" />
                    <div className="h-2 w-12 bg-white/10 rounded" />
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
