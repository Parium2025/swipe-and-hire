import { memo } from 'react';
import { motion } from 'framer-motion';

/**
 * Full-screen skeleton overlay for SearchJobs.
 * Covers everything with a smooth shimmer while data loads,
 * then fades out when ready.
 */

export const JobListSkeleton = memo(function JobListSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-[9998] bg-parium-gradient flex flex-col overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Title area */}
      <div className="flex items-center justify-center pt-4 pb-2">
        <div className="h-5 w-24 bg-white/10 rounded animate-pulse" />
      </div>

      {/* Search bar skeleton */}
      <div className="px-4 pb-3">
        <div className="h-11 w-full bg-white/5 border border-white/10 rounded-xl animate-pulse" />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-center gap-3 px-4 pb-3">
        <div className="h-8 w-20 bg-white/5 border border-white/10 rounded-full animate-pulse" />
        <div className="h-8 w-24 bg-white/5 border border-white/10 rounded-full animate-pulse" />
      </div>

      {/* Section title */}
      <div className="flex items-center justify-center pb-3">
        <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
      </div>

      {/* Job card skeletons */}
      <div className="flex-1 px-4 space-y-4 overflow-hidden">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden animate-pulse">
            {/* Image area */}
            <div className="h-36 bg-white/5" />
            {/* Info area */}
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
    </motion.div>
  );
});

export const SwipeModeSkeleton = memo(function SwipeModeSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-[9999] bg-parium-gradient flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Header – matches SwipeHeader layout */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="h-8 w-28 bg-white/10 rounded-full animate-pulse" />
          <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Dots – matches SwipeDots */}
      <div className="flex justify-center gap-1.5 py-1.5">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`h-1.5 rounded-full animate-pulse ${i === 1 ? 'w-6 bg-white/40' : 'w-1.5 bg-white/15'}`} />
        ))}
      </div>

      {/* Full-screen card – mimics the actual swipe card */}
      <div className="flex-1 mx-3 mb-3 rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden relative">
        {/* Full card background shimmer (like the job image) */}
        <div className="absolute inset-0 bg-white/[0.03] animate-pulse" />

        {/* Content overlay – positioned like JobSlide (top-[25%]) */}
        <div className="absolute inset-x-0 top-[25%] px-6 space-y-4">
          {/* Company name */}
          <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
          {/* Job title (large, like text-3xl) */}
          <div className="space-y-2">
            <div className="h-8 w-[85%] bg-white/10 rounded animate-pulse" />
            <div className="h-8 w-[55%] bg-white/10 rounded animate-pulse" />
          </div>
          {/* Metadata chips */}
          <div className="flex flex-wrap gap-2 pt-2">
            <div className="h-6 w-24 bg-white/10 rounded-full animate-pulse" />
            <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
            <div className="h-6 w-28 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Bottom action buttons – matches swipe card footer */}
        <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-6">
          <div className="h-14 w-14 bg-white/10 rounded-full animate-pulse" />
          <div className="h-12 w-12 bg-white/10 rounded-full animate-pulse" />
          <div className="h-14 w-14 bg-white/10 rounded-full animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
});
