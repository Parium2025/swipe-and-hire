/** Profile-preview loading state with the same phone/monitor frame as the loaded view. */

const SHAPE = 'bg-white/10 animate-pulse';

export const ProfilePreviewSkeleton = ({ viewMode = 'mobile' }: { viewMode?: 'mobile' | 'desktop' }) => (
  <div className="min-h-screen w-full" aria-busy="true" aria-label="Laddar profilförhandsvisning">
    <div className="py-6 responsive-container-wide space-y-6">
      <div className="mb-6 flex flex-col items-center gap-4 text-center">
        <div className={`h-7 w-52 rounded ${SHAPE}`} />
        <div className={`h-4 w-96 max-w-[90%] rounded ${SHAPE}`} />
      </div>
      <div className="mx-auto flex h-10 w-56 gap-1 rounded-lg bg-white/5 p-1">
        <div className={`h-8 flex-1 rounded-md ${SHAPE}`} />
        <div className={`h-8 flex-1 rounded-md ${SHAPE}`} />
      </div>

      {viewMode === 'mobile' ? (
        <div className="flex justify-center">
          <div className="relative h-[400px] w-[200px] scale-90 rounded-[2.4rem] bg-black p-1.5 shadow-2xl sm:scale-100">
            <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-white/5">
              <div className={`absolute inset-0 ${SHAPE}`} />
              <div className="absolute inset-x-4 bottom-6 space-y-2">
                <div className={`h-6 w-4/5 rounded ${SHAPE}`} />
                <div className={`h-3 w-1/2 rounded ${SHAPE}`} />
                <div className="flex gap-2 pt-2">
                  <div className={`h-6 w-16 rounded-full ${SHAPE}`} />
                  <div className={`h-6 w-20 rounded-full ${SHAPE}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="relative w-full mx-auto" style={{ maxWidth: 'clamp(220px, calc((100vh - 380px) * 1.6), 520px)' }}>
            <div className="relative w-full rounded-t-xl bg-black p-2 shadow-2xl">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border-2 border-white/10 bg-white/5 p-4">
                <div className="flex flex-col items-center gap-2">
                  <div className={`h-28 w-28 rounded-full ${SHAPE}`} />
                  <div className={`h-5 w-40 rounded ${SHAPE}`} />
                  <div className={`h-3 w-24 rounded ${SHAPE}`} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map(item => <div key={item} className={`h-16 rounded-lg ${SHAPE}`} />)}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-8 w-16 rounded-b-sm bg-white/10" />
              <div className="h-3 w-40 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default ProfilePreviewSkeleton;
