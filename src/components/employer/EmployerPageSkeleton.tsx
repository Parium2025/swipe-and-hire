import { memo, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

/**
 * Full-screen skeleton overlays for the employer side, mirroring
 * `SearchPageSkeleton` (job seeker) so the cold-load / browser-refresh
 * experience feels identical between the two sides.
 *
 * Portaled to document.body so app/layout containers can never clip them.
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
        <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse" />
        <div className="h-8 w-8 rounded-full bg-white/10 ring-2 ring-white/20 animate-pulse" />
      </div>
    </header>
  );
});

/** Skeleton for /dashboard and /my-jobs — stats grid + tabs + job cards */
export const EmployerDashboardSkeleton = memo(function EmployerDashboardSkeleton() {
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

        <div className="flex-1 min-h-0 overflow-hidden p-3 space-y-4">
          {/* Page title */}
          <div className="flex items-center justify-center mb-2">
            <div className="h-7 w-44 bg-white/10 rounded animate-pulse" />
          </div>

          {/* Stats grid (4 cards) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2 animate-pulse">
                <div className="h-4 w-20 bg-white/10 rounded" />
                <div className="h-7 w-12 bg-white/10 rounded" />
                <div className="h-3 w-16 bg-white/10 rounded" />
              </div>
            ))}
          </div>

          {/* Search bar */}
          <div className="h-11 w-full bg-white/5 border border-white/10 rounded-xl animate-pulse" />

          {/* Status tabs */}
          <div className="flex items-center justify-center gap-2">
            <div className="h-8 w-20 bg-white/10 rounded-full animate-pulse" />
            <div className="h-8 w-24 bg-white/10 rounded-full animate-pulse" />
            <div className="h-8 w-20 bg-white/10 rounded-full animate-pulse" />
          </div>

          {/* Job cards */}
          <div className="flex-1 space-y-3 overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden animate-pulse">
                <div className="h-32 bg-white/5" />
                <div className="p-3 space-y-2">
                  <div className="h-5 w-3/4 bg-white/10 rounded" />
                  <div className="h-3.5 w-1/2 bg-white/10 rounded" />
                  <div className="flex gap-2 pt-1">
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

/** Skeleton for /home (employer) — greeting + dashboard grid widgets */
export const EmployerHomeSkeleton = memo(function EmployerHomeSkeleton() {
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

        <div className="flex-1 min-h-0 overflow-hidden p-3 space-y-5">
          {/* Greeting block */}
          <div className="space-y-3 pt-2 text-center">
            <div className="h-9 w-3/4 max-w-md mx-auto bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-32 mx-auto bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-48 mx-auto bg-white/10 rounded animate-pulse" />
          </div>

          {/* Dashboard widget grid (2x3) */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-4 h-28 animate-pulse">
                <div className="h-4 w-16 bg-white/10 rounded mb-3" />
                <div className="h-6 w-10 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});
