import { memo, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

/**
 * Full-screen skeleton overlay for SearchJobs.
 * Portaled to document.body so app/layout containers can never clip it.
 */

const fullscreenSkeletonStyle: CSSProperties = {
  position: 'fixed',
  top: 'calc(-1 * env(safe-area-inset-top, 0px))',
  right: 0,
  bottom: 'calc(-1 * env(safe-area-inset-bottom, 0px) - 96px)',
  left: 0,
  width: '100vw',
  maxWidth: '100vw',
  height: 'auto',
  minHeight: 'calc(100dvh + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px) + 96px)',
  zIndex: 2147483647,
  background: 'var(--gradient-parium)',
  backgroundColor: 'hsl(var(--background))',
  boxSizing: 'border-box',
  transform: 'translateZ(0)',
  WebkitTransform: 'translateZ(0)',
  touchAction: 'none',
  overscrollBehavior: 'none',
};

const FullscreenSkeletonPortal = ({ children }: { children: ReactNode }) => {
  if (typeof document === 'undefined') return <>{children}</>;
  return createPortal(children, document.body);
};

const SkeletonChrome = memo(function SkeletonChrome() {
  return (
    <header className="relative shrink-0 min-h-14 flex items-center justify-between border-b border-white/20 bg-transparent px-3">
      <div className="h-10 w-40 rounded-md bg-white/10 animate-pulse" />
      <div className="absolute left-1/2 -translate-x-1/2 h-5 w-16 rounded bg-white/10 animate-pulse" />
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse" />
        <div className="h-8 w-8 rounded-full bg-white/10 ring-2 ring-white/20 animate-pulse" />
      </div>
    </header>
  );
});

export const JobListSkeleton = memo(function JobListSkeleton() {
  return (
    <FullscreenSkeletonPortal>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col overflow-hidden [padding-top:var(--top-chrome-content-offset,0px)]"
        style={fullscreenSkeletonStyle}
      >
        <SkeletonChrome />

        <div className="flex-1 min-h-0 overflow-hidden p-3 space-y-3 md:space-y-4">
          <div className="flex items-center justify-center mb-1 md:mb-4">
            <div className="h-7 w-28 bg-white/10 rounded animate-pulse" />
          </div>

          <div>
            <div className="h-11 w-full bg-white/5 border border-white/10 rounded-xl animate-pulse" />
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="h-8 w-20 bg-white/5 border border-white/10 rounded-full animate-pulse" />
            <div className="h-8 w-24 bg-white/5 border border-white/10 rounded-full animate-pulse" />
          </div>

          <div className="flex items-center justify-center">
            <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
          </div>

          <div className="flex-1 space-y-4 overflow-hidden">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden animate-pulse">
                <div className="h-36 bg-white/5" />
                <div className="p-3 space-y-2">
                  <div className="h-5 w-3/4 bg-white/10 rounded" />
                  <div className="h-3.5 w-1/2 bg-white/10 rounded" />
                  <div className="flex gap-2 pt-0.5">
                    <div className="h-5 w-16 bg-white/10 rounded-full" />
                    <div className="h-5 w-20 bg-white/10 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});

export const SwipeModeSkeleton = memo(function SwipeModeSkeleton() {
  return (
    <FullscreenSkeletonPortal>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col overflow-hidden [padding-top:var(--top-chrome-content-offset,0px)]"
        style={fullscreenSkeletonStyle}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 bg-white/10 rounded-full animate-pulse" />
            <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>

        <div className="flex justify-center gap-1.5 py-1.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`h-1.5 rounded-full animate-pulse ${i === 1 ? 'w-6 bg-white/40' : 'w-1.5 bg-white/15'}`} />
          ))}
        </div>

        <div className="flex-1 mx-3 mb-3 rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden relative">
          <div className="absolute inset-0 bg-white/[0.03] animate-pulse" />

          <div className="absolute inset-x-0 top-[25%] px-6 space-y-4">
            <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-8 w-[85%] bg-white/10 rounded animate-pulse" />
              <div className="h-8 w-[55%] bg-white/10 rounded animate-pulse" />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <div className="h-6 w-24 bg-white/10 rounded-full animate-pulse" />
              <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
              <div className="h-6 w-28 bg-white/10 rounded-full animate-pulse" />
            </div>
          </div>

          <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-6">
            <div className="h-14 w-14 bg-white/10 rounded-full animate-pulse" />
            <div className="h-12 w-12 bg-white/10 rounded-full animate-pulse" />
            <div className="h-14 w-14 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});
