/**
 * JobViewSkeleton — matches JobView layout exactly.
 * Hero-media (2:1), header pill, logo + company row, title, detail rows
 * with dividers, apply button. Unified `bg-white/10` shape tone.
 */

const SHAPE = 'bg-white/10 animate-pulse';

interface JobViewSkeletonProps {
  asOverlay?: boolean;
}

export const JobViewSkeleton = ({ asOverlay = false }: JobViewSkeletonProps) => {
  return (
    <div
      className={
        asOverlay
          ? 'fixed inset-0 z-50 h-[100dvh] overflow-y-auto overscroll-contain bg-[hsl(215_100%_12%)] bg-parium-gradient'
          : 'min-h-[100dvh] overflow-y-auto bg-[hsl(215_100%_12%)] bg-parium-gradient'
      }
      style={{ isolation: 'isolate' }}
    >
      <div className="jobview-container py-4">
        {/* Header pill: back + share */}
        <div className="flex items-center mb-4 bg-white/10 backdrop-blur-sm p-3 rounded-lg gap-3 justify-between">
          <div className={`h-11 w-28 rounded-full ${SHAPE}`} />
          <div className={`h-11 w-11 rounded-full ${SHAPE}`} />
        </div>

        {/* Hero media (2:1) */}
        <div
          className={`w-full rounded-xl overflow-hidden ${SHAPE}`}
          style={{ aspectRatio: 'var(--job-media-aspect, 2 / 1)' }}
        />

        {/* Company row (logo + name) */}
        <div className="flex flex-col items-center gap-2 mt-4 mb-3">
          <div className={`h-14 w-14 rounded-full ${SHAPE}`} />
          <div className={`h-4 w-40 rounded ${SHAPE}`} />
        </div>

        {/* Title */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className={`h-7 w-3/4 rounded ${SHAPE}`} />
          <div className={`h-7 w-1/2 rounded ${SHAPE}`} />
        </div>

        {/* Detail rows with dividers */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl overflow-hidden">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className={`h-4 w-24 rounded ${SHAPE}`} />
                <div className={`h-4 rounded ${SHAPE}`} style={{ width: `${40 + (i % 3) * 20}%`, maxWidth: '55%' }} />
              </div>
              {i < 6 && <div className="h-px bg-white/10 mx-4" />}
            </div>
          ))}
        </div>

        {/* Benefits block — 6 pill-badges (matchar JobViewBenefits grid) */}
        <div className="mt-6 space-y-3">
          <div className={`h-5 w-32 rounded ${SHAPE}`} />
          <div className="flex flex-wrap gap-2">
            <div className={`h-8 w-24 rounded-full ${SHAPE}`} />
            <div className={`h-8 w-28 rounded-full ${SHAPE}`} />
            <div className={`h-8 w-20 rounded-full ${SHAPE}`} />
            <div className={`h-8 w-32 rounded-full ${SHAPE}`} />
            <div className={`h-8 w-24 rounded-full ${SHAPE}`} />
            <div className={`h-8 w-28 rounded-full ${SHAPE}`} />
          </div>
        </div>

        {/* Description block */}
        <div className="mt-6 space-y-2">
          <div className={`h-4 w-full rounded ${SHAPE}`} />
          <div className={`h-4 w-11/12 rounded ${SHAPE}`} />
          <div className={`h-4 w-10/12 rounded ${SHAPE}`} />
          <div className={`h-4 w-9/12 rounded ${SHAPE}`} />
        </div>

        {/* Footer meta (createdAt / expiresAt) */}
        <div className="mt-6 flex items-center justify-between">
          <div className={`h-3 w-32 rounded ${SHAPE}`} />
          <div className={`h-3 w-28 rounded ${SHAPE}`} />
        </div>

        {/* Apply button */}
        <div className={`h-12 w-full rounded-xl mt-6 ${SHAPE}`} />
      </div>
    </div>
  );
};

export default JobViewSkeleton;
