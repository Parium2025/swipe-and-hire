import { memo, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { readCachedCount, SKELETON_COUNT_KEYS } from '@/lib/skeletonCounts';

/**
 * Full-screen skeleton overlay for SearchJobs.
 * Portaled to document.body so app/layout containers can never clip it.
 *
 * COLOR STANDARD: All skeleton shapes use ONE unified tone (`bg-white/10`)
 * — matches the tone of the logo-circle placeholder. Inspired by Lovable's
 * skeleton system: uniform, calm, premium. No mixed opacities, no borders,
 * no coloured accents (destructive/success/secondary) during loading.
 */

const SKELETON_SHAPE = 'bg-white/10 animate-pulse';

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
    <>
      {/* MOBILE chrome — mirrors JobSeekerLayout header exactly:
          rings-logo (h-10 w-12) | absolute-centered "Parium" text |
          [Search 9x9] [Notification 9x9] [Avatar 8x8 ring-2] */}
      <header className="lg:hidden relative shrink-0 min-h-14 flex items-center justify-between border-b border-white/20 bg-transparent px-3">
        <div className={`h-10 w-12 rounded-md ${SKELETON_SHAPE}`} />
        <div className={`absolute left-1/2 -translate-x-1/2 h-4 w-14 rounded ${SKELETON_SHAPE}`} />
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 rounded-full ${SKELETON_SHAPE}`} />
          <div className={`h-9 w-9 rounded-full ${SKELETON_SHAPE}`} />
          <div className={`h-8 w-8 rounded-full ring-2 ring-white/20 ${SKELETON_SHAPE}`} />
        </div>
      </header>
      {/* DESKTOP chrome — mirrors JobSeekerTopNav exactly (h-14, left-aligned pills) */}
      <header className="hidden lg:flex shrink-0 h-14 items-center border-b border-white/20 bg-transparent">
        <div className="w-full responsive-container-wide flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className={`h-10 w-10 rounded-lg ${SKELETON_SHAPE}`} />
            <div className="flex items-center gap-1 ml-1">
              <div className={`h-9 w-[92px] rounded-lg ${SKELETON_SHAPE}`} />
              <div className={`h-9 w-[104px] rounded-lg ${SKELETON_SHAPE}`} />
              <div className={`h-9 w-[112px] rounded-lg ${SKELETON_SHAPE}`} />
              <div className={`h-9 w-[104px] rounded-lg ${SKELETON_SHAPE}`} />
              <div className={`h-9 w-9 rounded-lg ${SKELETON_SHAPE}`} />
              <div className={`h-9 w-[68px] rounded-lg ${SKELETON_SHAPE}`} />
            </div>
          </div>
        </div>
      </header>
    </>
  );
});

export const JobListSkeleton = memo(function JobListSkeleton() {
  const cardCount = readCachedCount(SKELETON_COUNT_KEYS.searchJobs);
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
          {/* "Sök Jobb" title */}
          <div className="flex items-center justify-center">
            <div className={`h-6 w-24 rounded ${SKELETON_SHAPE}`} />
          </div>

          {/* Search card: input + saved-searches pill + two filter pills */}
          <div className="rounded-2xl p-3 space-y-3">
            <div className={`h-11 w-full rounded-xl ${SKELETON_SHAPE}`} />
            <div className="flex justify-center">
              <div className={`h-9 w-52 rounded-full ${SKELETON_SHAPE}`} />
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className={`h-9 w-24 rounded-full ${SKELETON_SHAPE}`} />
              <div className={`h-9 w-28 rounded-full ${SKELETON_SHAPE}`} />
            </div>
          </div>

          {/* "Jobbsökresultat" title */}
          <div className="flex items-center justify-center pt-1">
            <div className={`h-5 w-36 rounded ${SKELETON_SHAPE}`} />
          </div>

          {/* Count chips */}
          <div className="flex items-center justify-center gap-3">
            <div className={`h-8 w-20 rounded-full ${SKELETON_SHAPE}`} />
            <div className={`h-8 w-24 rounded-full ${SKELETON_SHAPE}`} />
          </div>

          {/* Swipe Mode button */}
          <div className="flex items-center justify-center">
            <div className={`h-11 w-44 rounded-full ${SKELETON_SHAPE}`} />
          </div>

          <div className="flex-1 overflow-hidden">
            <div className={`job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4${cardCount === 1 ? ' job-card-grid-single' : cardCount === 2 ? ' job-card-grid-double' : ''}`}>
              {Array.from({ length: cardCount }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-white/[0.04]">
                  {/* Bild — samma aspekt (2:1) som riktiga jobbkortet & hero */}
                  <div className={`w-full ${SKELETON_SHAPE}`} style={{ aspectRatio: 'var(--job-media-aspect, 2 / 1)' }} />
                  {/* Kortkropp — matchar ReadOnlyMobileJobCard exakt:
                      logo UNDER bilden (pt-1), aldrig -mt-8/överhäng. */}
                  <div className="p-4 space-y-2.5">
                    {/* Logo (w-14 h-14 som riktiga kortet) */}
                    <div className="flex justify-center pt-1">
                      <div className={`h-14 w-14 rounded-full ${SKELETON_SHAPE}`} />
                    </div>
                    {/* Titel — 2 rader centrerad */}
                    <div className="space-y-2 pt-1">
                      <div className={`h-5 w-4/5 mx-auto rounded ${SKELETON_SHAPE}`} />
                      <div className={`h-5 w-3/5 mx-auto rounded ${SKELETON_SHAPE}`} />
                    </div>
                    {/* Info-pills */}
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      <div className={`h-6 w-20 rounded-full ${SKELETON_SHAPE}`} />
                      <div className={`h-6 w-24 rounded-full ${SKELETON_SHAPE}`} />
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <div className={`h-6 w-28 rounded-full ${SKELETON_SHAPE}`} />
                      <div className={`h-6 w-24 rounded-full ${SKELETON_SHAPE}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
        {/* Höjd = viewport (100dvh), INTE portalens overhang (som är
            100dvh + safe-areas + 96px för iOS bounce). Utan detta blir
            kortet för högt och `top-[20%]` inuti hero-blocket landar
            längre ner än i det riktiga JobSlide. */}
        <div
          className="relative w-full"
          style={{ height: '100dvh' }}
        >
          <div
            className="h-full w-full flex flex-col px-3"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top,0px) + 4.75rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 1.25rem)',
            }}
          >
            <div className="relative h-full rounded-2xl overflow-hidden bg-[hsl(215,85%,15%)] shadow-[0_18px_45px_-10px_rgba(0,0,0,0.4),0_6px_16px_-4px_rgba(0,0,0,0.25)]">
              {/* Bakgrundsplatta */}
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

              {/* OccupationBadge */}
              <div className="absolute top-5 left-5 z-10">
                <div className={`h-[26px] w-28 rounded-full ${SKELETON_SHAPE}`} />
              </div>

              {/* JobSlideContent — flyttad något uppåt för att matcha
                  verkligt kort ännu mer exakt (16 % istället för 20 %). */}
              <div className="absolute inset-x-0 top-[16%] bottom-28 z-10 flex items-center justify-center px-6">
                <div className="mx-auto w-full max-w-[21rem] flex flex-col items-center">
                  {/* Logo */}
                  <div className={`w-14 h-14 rounded-full mb-4 ${SKELETON_SHAPE}`} />

                  {/* Företags-pill */}
                  <div className={`h-[28px] w-40 max-w-[80%] rounded-full ${SKELETON_SHAPE}`} />

                  {/* Titel — 2 rader */}
                  <div className="mt-1 w-full flex flex-col items-center gap-1.5">
                    <div className={`h-7 w-[85%] rounded ${SKELETON_SHAPE}`} />
                    <div className={`h-7 w-[60%] rounded ${SKELETON_SHAPE}`} />
                  </div>

                  {/* Subtitel */}
                  <div className={`mt-2 h-5 w-56 max-w-[75%] rounded ${SKELETON_SHAPE}`} />

                  {/* Info pills — stackade vertikalt */}
                  <div className="mt-3 flex flex-col items-center gap-2 w-full">
                    <div className={`h-7 w-48 max-w-[75%] rounded-full ${SKELETON_SHAPE}`} />
                    <div className={`h-7 w-56 max-w-[85%] rounded-full ${SKELETON_SHAPE}`} />
                    <div className={`h-7 w-32 max-w-[55%] rounded-full ${SKELETON_SHAPE}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SwipeHeader */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
            <div className="py-3">
              <div className={`h-3 w-10 rounded ${SKELETON_SHAPE}`} />
            </div>
            <div className="flex h-11 w-11 items-center justify-center">
              <div className={`h-9 w-9 rounded-full ${SKELETON_SHAPE}`} />
            </div>
          </div>
          <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2 pt-[env(safe-area-inset-top,0px)]">
            <div className="py-3">
              <div className={`h-12 w-[150px] rounded-full ${SKELETON_SHAPE}`} />
            </div>
          </div>

          {/* SwipeActionsBar — unified color (no destructive/success/secondary during loading) */}
          <div
            className="fixed inset-x-0 z-[2147483647] px-5 pointer-events-none"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.25rem)' }}
          >
            <div className="flex items-center justify-center gap-4">
              <div className={`w-[52px] h-[52px] rounded-full ${SKELETON_SHAPE}`} />
              <div className={`w-[52px] h-[52px] rounded-full ${SKELETON_SHAPE}`} />
              <div className={`w-[52px] h-[52px] rounded-full ${SKELETON_SHAPE}`} />
              <div className={`w-[52px] h-[52px] rounded-full ${SKELETON_SHAPE}`} />
            </div>
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});

/**
 * Skeleton for /my-applications — mirrors seeker chrome + title + tab pills
 * + job card grid, using the per-tab cached count.
 */
export const MyApplicationsSkeleton = memo(function MyApplicationsSkeleton({
  activeTab = 'active',
}: {
  activeTab?: 'active' | 'expired';
}) {
  const key =
    activeTab === 'expired'
      ? SKELETON_COUNT_KEYS.myApplicationsExpired
      : SKELETON_COUNT_KEYS.myApplicationsActive;
  const cardCount = readCachedCount(key, 3);
  const interviewCount = readCachedCount(SKELETON_COUNT_KEYS.myApplicationsInterviews, 0, 3);
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

        <div className="flex-1 min-h-0 overflow-hidden p-3">
          <div className="responsive-container-wide space-y-8">
          {interviewCount > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-9 w-9 rounded-lg ${SKELETON_SHAPE}`} />
                <div className="space-y-2">
                  <div className={`h-5 w-44 rounded ${SKELETON_SHAPE}`} />
                  <div className={`h-4 w-36 rounded ${SKELETON_SHAPE}`} />
                </div>
              </div>
              <div className="space-y-4">
                {Array.from({ length: interviewCount }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-full ${SKELETON_SHAPE}`} />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className={`h-4 w-3/5 rounded ${SKELETON_SHAPE}`} />
                        <div className={`h-3 w-2/5 rounded ${SKELETON_SHAPE}`} />
                      </div>
                      <div className={`h-8 w-24 rounded-full ${SKELETON_SHAPE}`} />
                    </div>
                    <div className={`h-10 w-full rounded-lg ${SKELETON_SHAPE}`} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            {/* Title + subtitle */}
            <div className="flex flex-col items-center gap-2 mb-5">
              <div className={`h-6 w-48 rounded ${SKELETON_SHAPE}`} />
              <div className={`h-4 w-56 rounded ${SKELETON_SHAPE}`} />
            </div>

          {/* Tab pills — "Under granskning (n)" | "Utgångna (n)" */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className={`h-9 w-44 rounded-full ${SKELETON_SHAPE}`} />
            <div className={`h-9 w-32 rounded-full ${SKELETON_SHAPE}`} />
          </div>

          {/* Card grid — samma struktur som JobListSkeleton */}
          <div className="flex-1 overflow-hidden">
            {cardCount === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center space-y-4">
                <div className={`h-12 w-12 rounded-full mx-auto ${SKELETON_SHAPE}`} />
                <div className={`h-5 w-44 rounded mx-auto ${SKELETON_SHAPE}`} />
                <div className={`h-4 w-64 max-w-full rounded mx-auto ${SKELETON_SHAPE}`} />
              </div>
            ) : (
              <div className={`job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4${cardCount === 1 ? ' job-card-grid-single' : cardCount === 2 ? ' job-card-grid-double' : ''}`}>
                {Array.from({ length: cardCount }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden bg-white/[0.04]">
                    <div className={`w-full ${SKELETON_SHAPE}`} style={{ aspectRatio: 'var(--job-media-aspect, 2 / 1)' }} />
                    <div className="p-4 space-y-2.5">
                      <div className="flex justify-center pt-1">
                        <div className={`h-14 w-14 rounded-full ${SKELETON_SHAPE}`} />
                      </div>
                      <div className="space-y-2 pt-1">
                        <div className={`h-5 w-4/5 mx-auto rounded ${SKELETON_SHAPE}`} />
                        <div className={`h-5 w-3/5 mx-auto rounded ${SKELETON_SHAPE}`} />
                      </div>
                      {/* Status-badge rad (unikt för MyApplications) */}
                      <div className="flex justify-center pt-1">
                        <div className={`h-6 w-28 rounded-full ${SKELETON_SHAPE}`} />
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        <div className={`h-6 w-20 rounded-full ${SKELETON_SHAPE}`} />
                        <div className={`h-6 w-24 rounded-full ${SKELETON_SHAPE}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </section>
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});
