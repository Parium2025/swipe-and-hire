/**
 * ProfilePreviewSkeleton — matches ProfilePreview layout.
 * Header, avatar circle, name/age, bio, tabs, info rows, CV block.
 */

const SHAPE = 'bg-white/10 animate-pulse';

export const ProfilePreviewSkeleton = () => (
  <div className="p-6 responsive-container-wide">
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <div className={`h-8 w-40 rounded ${SHAPE}`} />
      <div className={`h-10 w-24 rounded-full ${SHAPE}`} />
    </div>

    {/* Card with avatar + name */}
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-4">
      <div className="flex flex-col items-center gap-3">
        <div className={`h-32 w-32 rounded-full ${SHAPE}`} />
        <div className={`h-6 w-48 rounded ${SHAPE}`} />
        <div className={`h-4 w-24 rounded ${SHAPE}`} />
      </div>

      {/* Bio lines */}
      <div className="mt-6 space-y-2">
        <div className={`h-4 w-full rounded ${SHAPE}`} />
        <div className={`h-4 w-11/12 rounded ${SHAPE}`} />
        <div className={`h-4 w-9/12 rounded ${SHAPE}`} />
      </div>
    </div>

    {/* Tab pills */}
    <div className="flex gap-2 mb-4">
      <div className={`h-9 w-24 rounded-full ${SHAPE}`} />
      <div className={`h-9 w-28 rounded-full ${SHAPE}`} />
    </div>

    {/* Info rows */}
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className={`h-4 w-24 rounded ${SHAPE}`} />
            <div className={`h-4 rounded ${SHAPE}`} style={{ width: `${35 + (i % 3) * 15}%`, maxWidth: '55%' }} />
          </div>
          {i < 4 && <div className="h-px bg-white/10 mx-4" />}
        </div>
      ))}
    </div>

    {/* CV block */}
    <div className={`h-24 w-full rounded-2xl mt-4 ${SHAPE}`} />
  </div>
);

export default ProfilePreviewSkeleton;
