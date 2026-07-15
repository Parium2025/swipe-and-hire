import { memo, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

/**
 * Full-screen skeleton overlays for the employer side, mirroring
 * `SearchPageSkeleton` (job seeker) so the cold-load / browser-refresh
 * experience feels identical between the two sides.
 *
 * COLOR STANDARD: All skeleton shapes use ONE unified tone (`bg-white/10`)
 * — no mixed opacities, no borders, no coloured accents during loading.
 *
 * LAYOUT PARITY: Container + spacing mirrors the real pages
 * (EmployerHome, EmployerDashboard) so shapes sit where the real cards
 * will land — no jump on hand-off.
 */

const SHAPE = 'bg-white/10 animate-pulse';

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
      {/* Left: Parium logo (real: h-10 w-40) */}
      <div className={`h-10 w-40 rounded-md ${SHAPE}`} />
      {/* Center: "Parium" wordmark */}
      <div className={`absolute left-1/2 -translate-x-1/2 h-5 w-16 rounded ${SHAPE}`} />
      {/* Right: Plus + Notifications + Avatar */}
      <div className="flex items-center gap-2">
        <div className={`h-9 w-9 rounded-full ${SHAPE}`} />
        <div className={`h-9 w-9 rounded-full ${SHAPE}`} />
        <div className={`h-8 w-8 rounded-full ring-2 ring-white/20 ${SHAPE}`} />
      </div>
    </header>
  );
});

/**
 * Skeleton for /dashboard and /my-jobs — mirrors the real EmployerDashboard:
 *   - responsive-container-wide + space-y-4
 *   - centered page title
 *   - StatsGrid (mobile: 1 full-width multi-col card + 3-col row of 3 cards)
 *   - JobSearchBar (input + sort pill row)
 *   - JobStatusTabs (3 pills centered)
 *   - Mobile job cards: p-4 rounded-lg with logo + text + pills (matches
 *     the in-page loading block inside EmployerDashboard.tsx).
 */
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

        {/* Mirror EmployerMobileShell <main class="p-3"> + inner responsive-container-wide */}
        <div className="flex-1 min-h-0 overflow-hidden p-3">
          <div className="responsive-container-wide space-y-4">
          {/* Page title — "Mina jobbannonser" (text-xl mobile / md:text-2xl) */}
          <div className="flex justify-center items-center mb-6">
            <div className={`h-7 w-48 rounded ${SHAPE}`} />
          </div>

          {/* StatsGrid — mobile shape:
              (1) full-width multi-col card (Aktiva | Utgångna | Utkast)
              (2) 3-col grid with 3 short cards (Annonser / Visningar / Ansökningar) */}
          <div className="md:hidden space-y-2">
            <div className="rounded-lg overflow-hidden border border-white/10 bg-white/[0.03]">
              <div className="flex h-[62px]">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`flex-1 flex flex-col items-center justify-center gap-1.5 ${i > 1 ? 'border-l border-white/10' : ''}`}
                  >
                    <div className={`h-3 w-12 rounded ${SHAPE}`} />
                    <div className={`h-4 w-6 rounded ${SHAPE}`} />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="rounded-lg h-[62px] flex flex-col items-center justify-center gap-1.5 border border-white/10 bg-white/[0.03]"
                >
                  <div className={`h-3 w-14 rounded ${SHAPE}`} />
                  <div className={`h-4 w-6 rounded ${SHAPE}`} />
                </div>
              ))}
            </div>
          </div>

          {/* StatsGrid desktop shape — 5 columns */}
          <div className="hidden md:grid md:grid-cols-5 gap-2">
            <div className={`col-span-2 h-[76px] rounded-lg ${SHAPE}`} />
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-[76px] rounded-lg ${SHAPE}`} />
            ))}
          </div>

          {/* JobSearchBar row */}
          <div className={`h-11 w-full rounded-xl ${SHAPE}`} />

          {/* JobStatusTabs — 3 pills centered */}
          <div className="flex justify-center items-center gap-2">
            <div className={`h-9 w-24 rounded-full ${SHAPE}`} />
            <div className={`h-9 w-28 rounded-full ${SHAPE}`} />
            <div className={`h-9 w-24 rounded-full ${SHAPE}`} />
          </div>

          {/* Mobile: job cards (matches the in-page skeleton inside
              EmployerDashboard: p-4 rounded-lg, logo left + text + pills) */}
          <div className="md:hidden space-y-3 px-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg ${SHAPE}`} />
                  <div className="flex-1 space-y-2">
                    <div className={`h-4 w-3/4 rounded ${SHAPE}`} />
                    <div className={`h-3 w-1/2 rounded ${SHAPE}`} />
                    <div className="flex gap-2 mt-2">
                      <div className={`h-5 w-16 rounded-full ${SHAPE}`} />
                      <div className={`h-5 w-20 rounded-full ${SHAPE}`} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: card grid (1/2/3 cols) */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={`rounded-xl h-64 ${SHAPE}`} />
            ))}
          </div>
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});

/**
 * Skeleton for /home (employer) — mirrors the real EmployerHome:
 *   - responsive-container-wide + py-2 sm:py-3
 *   - centered greeting block (h1 + date/time + weather line)
 *   - "Din översikt" section heading with sparkles slot
 *   - HomeDashboardGrid: grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 (4 cards)
 */
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

        <div className="flex-1 min-h-0 overflow-hidden responsive-container-wide py-2 sm:py-3 space-y-3 sm:space-y-6">
          {/* Greeting block — centered on mobile, left-aligned md+.
              Heights match text-2xl sm:text-4xl h1 + DateTime + weather line. */}
          <div className="text-center md:text-left flex flex-col gap-1 sm:gap-2 items-center md:items-start">
            <div className={`h-8 sm:h-11 w-3/4 max-w-md rounded ${SHAPE}`} />
            <div className={`h-4 w-40 rounded ${SHAPE}`} />
            <div className={`h-4 w-56 rounded ${SHAPE}`} />
          </div>

          {/* "Din översikt" section heading */}
          <div className="flex items-center gap-2 pt-1">
            <div className={`h-6 w-28 rounded ${SHAPE}`} />
            <div className={`h-5 w-5 rounded ${SHAPE}`} />
          </div>

          {/* HomeDashboardGrid — 1 col mobile, 2 cols sm+, 4 cards, tall */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`rounded-2xl h-56 sm:h-64 ${SHAPE}`} />
            ))}
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});
