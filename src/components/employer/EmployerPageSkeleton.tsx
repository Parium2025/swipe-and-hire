import { memo, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { readCachedCount, SKELETON_COUNT_KEYS } from '@/lib/skeletonCounts';
import { useLiveSkeletonCount, viewportRowCap } from '@/lib/useLiveSkeletonCount';
import { isEmployerJobActive, isEmployerJobExpired, isEmployerJobDraft } from '@/lib/jobStatus';
import { useDevice } from '@/hooks/use-device';

/**
 * Hybrid skeleton count: read live from React Query cache first (accurate
 * even after data changed since last visit), then fall back to
 * localStorage last-known-count, then to the numeric fallback.
 */
function useLiveEmployerJobCount(tab: 'active' | 'expired' | 'draft', fallbackKey: string): number {
  const qc = useQueryClient();
  // Look for any cached ['jobs', ...] entry with data
  const entries = qc.getQueriesData<any[]>({ queryKey: ['jobs'] });
  for (const [, data] of entries) {
    if (Array.isArray(data)) {
      const filtered = data.filter(j =>
        tab === 'active' ? isEmployerJobActive(j) :
        tab === 'expired' ? isEmployerJobExpired(j) :
        isEmployerJobDraft(j)
      );
      // 0 annonser ⇒ 0 kortskelett. Skelettet ska aldrig låtsas att det finns
      // innehåll som inte finns — annars "blinkar" ett kort förbi på ett tomt konto.
      return Math.min(6, filtered.length);
    }
  }
  return readCachedCount(fallbackKey, 3, 6);
}


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
  // Följ appens riktiga brytpunkt (1180px + overflow-guard) i stället för
  // Tailwinds `lg` (1024px), annars visar skelettet fel header.
  const isDesktop = useDevice() === 'desktop';
  return (
    <>
      {/* MOBILE chrome — mirrors EmployerMobileShell header exactly:
          logo (h-10 w-40 bg image) | absolute-centered "Parium" text |
          [Plus 9x9] [Notification 9x9] [Avatar 8x8 ring-2 rounded-full] */}
      {!isDesktop && (
      <header className="relative shrink-0 min-h-14 flex items-center justify-between border-b border-white/20 bg-transparent px-3">
        <div className={`h-10 w-40 rounded-md ${SHAPE}`} />
        <div className={`absolute left-1/2 -translate-x-1/2 h-4 w-14 rounded ${SHAPE}`} />
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 rounded-full ${SHAPE}`} />
          <div className={`h-9 w-9 rounded-full ${SHAPE}`} />
          <div className={`h-8 w-8 rounded-full ring-2 ring-white/20 ${SHAPE}`} />
        </div>
      </header>
      )}
      {/* DESKTOP chrome — mirrors EmployerTopNav layout exactly.
          Real order (left→right):
            LEFT: logo | Annonser | Kandidater | Chattar | Företag | Notif | Profil-avatar
            RIGHT (extraRight): Skapa ny annons */}
      {isDesktop && (
      <header className="flex shrink-0 h-16 items-center border-b border-white/20 bg-transparent">
        <div className="w-full responsive-container-wide flex items-center justify-between">
          {/* Left group — allt sitter i samma gap-1 block som i EmployerTopNav */}
          <div className="flex items-center gap-1">
            {/* Parium-logo (PariumLogoButton är 40x40) */}
            <div className={`h-10 w-10 rounded-lg ${SHAPE}`} />
            <div className="flex items-center gap-1 ml-1">
              {/* Annonser (LayoutDashboard + text + count + chevron) */}
              <div className={`h-10 w-[140px] rounded-lg ${SHAPE}`} />
              {/* Kandidater */}
              <div className={`h-10 w-[135px] rounded-lg ${SHAPE}`} />
              {/* Chattar (utan count-pil, smalare) */}
              <div className={`h-10 w-[110px] rounded-lg ${SHAPE}`} />
              {/* Företag (avatar-cirkel + text + chevron) */}
              <div className={`h-10 w-[128px] rounded-lg ${SHAPE}`} />
              {/* NotificationCenter (rect variant, klocka) */}
              <div className={`h-10 w-10 rounded-lg ${SHAPE}`} />
              {/* Profil-dropdown (avatar + chevron) */}
              <div className={`h-10 w-[64px] rounded-lg ${SHAPE}`} />
            </div>
          </div>
          {/* Right group — extraRight: Skapa ny annons */}
          <div className="flex items-center gap-3">
            <div className={`h-10 w-[164px] rounded-lg ${SHAPE}`} />
          </div>
        </div>
      </header>
      )}
    </>
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
interface EmployerDashboardSkeletonProps {
  showDrafts?: boolean;
  titleWidthClass?: string;
}

export const EmployerDashboardSkeleton = memo(function EmployerDashboardSkeleton({
  showDrafts,
  titleWidthClass = 'w-48',
}: EmployerDashboardSkeletonProps = {}) {
  const resolvedShowDrafts = showDrafts ?? (typeof window !== 'undefined' ? window.location.pathname !== '/dashboard' : true);
  // Läs aktiv tab från URL så vi renderar rätt antal kort för den tab
  // användaren faktiskt kommer landa på (matchar EmployerDashboard).
  let tab: 'active' | 'expired' | 'draft' = 'active';
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t === 'expired' || t === 'draft') tab = t;
  }
  const countKey =
    tab === 'expired' ? SKELETON_COUNT_KEYS.myJobsExpired
    : tab === 'draft' ? SKELETON_COUNT_KEYS.myJobsDraft
    : SKELETON_COUNT_KEYS.myJobsActive;
  // Sidan paginerar med pageSize=18 — clampa så vi aldrig renderar fler placeholders
  // än vad som faktiskt får plats i första view.
  const cardCount = useLiveEmployerJobCount(tab, countKey);


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
          {/* Page title — matches Dashboard / Mina jobbannonser */}
          <div className="flex justify-center items-center mb-6">
            <div className={`h-7 ${titleWidthClass} rounded ${SHAPE}`} />
          </div>

          {/* StatsGrid — mobile shape mirrors the real dashboard exactly */}
          <div className="md:hidden space-y-2">
            <div className="rounded-lg overflow-hidden border border-white/20 bg-white/5">
              <div className="flex h-[62px]">
                {Array.from({ length: resolvedShowDrafts ? 3 : 2 }).map((_, index) => (
                  <div
                    key={index}
                    className={`flex-1 flex flex-col items-center justify-center gap-1.5 ${index > 0 ? 'border-l border-white/20' : ''}`}
                  >
                    <div className={`h-3 w-14 rounded ${SHAPE}`} />
                    <div className={`h-4 w-6 rounded ${SHAPE}`} />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="rounded-lg h-[62px] flex flex-col items-center justify-center gap-1.5 border border-white/20 bg-white/5"
                >
                  <div className={`h-3 w-14 rounded ${SHAPE}`} />
                  <div className={`h-4 w-6 rounded ${SHAPE}`} />
                </div>
              ))}
            </div>
          </div>

          {/* StatsGrid desktop shape — one multi-column card spanning 2 cols + 3 regular cards */}
          <div className="hidden md:grid md:grid-cols-5 gap-2">
            <div className={`col-span-2 h-[76px] rounded-lg ${SHAPE}`} />
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-[76px] rounded-lg ${SHAPE}`} />
            ))}
          </div>

          {/* JobSearchBar row — mobile has one inline search/sort control, desktop has search + sort button */}
          <div className={`md:hidden h-[3.05rem] w-full rounded-xl ${SHAPE}`} />
          <div className="hidden md:flex gap-2">
            <div className={`h-11 flex-1 rounded-xl ${SHAPE}`} />
            <div className={`h-11 w-44 rounded-xl ${SHAPE}`} />
          </div>

          {/* JobStatusTabs — Dashboard has 2, Mina jobbannonser has 3 */}
          <div className="flex justify-center items-center gap-2">
            <div className={`h-9 w-24 rounded-full ${SHAPE}`} />
            <div className={`h-9 w-28 rounded-full ${SHAPE}`} />
            {resolvedShowDrafts && <div className={`h-9 w-24 rounded-full ${SHAPE}`} />}
          </div>

          {/* Tomt konto: spegla den riktiga tomtext-raden i stället för kort. */}
          {cardCount === 0 && (
            <div className="flex justify-center py-12">
              <div className={`h-4 w-64 max-w-[80%] rounded ${SHAPE}`} />
            </div>
          )}

          {/* Mobile: MobileJobCard-formade kort — hero-media (2:1), logo-cirkel
              centrerad, titel, divider, list-rader, divider, action-rad.
              Antalet styrs av senast kända tab-count via localStorage. */}
          <div className="md:hidden flex flex-col items-center gap-4">
            {Array.from({ length: cardCount }).map((_, i) => (
              <div
                key={i}
                className="w-full max-w-[var(--job-card-mobile-max-width,24.5rem)] rounded-2xl overflow-hidden bg-white/5 border border-white/20"
              >
                {/* Hero media (2:1) med badge top-left + view counter top-right */}
                <div
                  className={`relative w-full ${SHAPE}`}
                  style={{ aspectRatio: 'var(--job-media-aspect, 2 / 1)' }}
                >
                  <div className="absolute top-2.5 left-2.5 h-5 w-14 rounded-full bg-white/15" />
                  <div className="absolute top-2.5 right-2.5 h-6 w-12 rounded-full bg-white/15" />
                </div>
                {/* Body */}
                <div className="flex flex-col gap-2 py-2">
                  {/* Logo-cirkel centrerad */}
                  <div className="flex justify-center mt-1">
                    <div className={`h-14 w-14 rounded-full ${SHAPE}`} />
                  </div>
                  {/* Titel — två rader centrerade */}
                  <div className="flex flex-col items-center gap-1.5 px-4">
                    <div className={`h-4 w-3/4 rounded ${SHAPE}`} />
                    <div className={`h-4 w-1/2 rounded ${SHAPE}`} />
                  </div>
                  <div className="h-px bg-white/10 mx-3 mt-1" />
                  {/* List-rader — label + värde */}
                  <div className="flex flex-col gap-2 px-4 py-1">
                    {[0, 1, 2].map(row => (
                      <div key={row} className="flex items-center justify-between">
                        <div className={`h-3 w-20 rounded ${SHAPE}`} />
                        <div className={`h-3 w-16 rounded ${SHAPE}`} />
                      </div>
                    ))}
                  </div>
                  <div className="h-px bg-white/10 mx-3" />
                  {/* Action-rad — Edit + Delete */}
                  <div className="flex gap-2 px-3 py-2">
                    <div className={`flex-1 h-11 rounded-full ${SHAPE}`} />
                    <div className={`flex-1 h-11 rounded-full ${SHAPE}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: card grid (1/2/3 cols) — samma card-form som mobil */}
          <div className={`hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4${cardCount === 1 ? ' job-card-grid-single' : cardCount === 2 ? ' job-card-grid-double' : ''}`}>
            {Array.from({ length: cardCount }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden bg-white/5 border border-white/20"
              >
                <div
                  className={`w-full ${SHAPE}`}
                  style={{ aspectRatio: 'var(--job-media-aspect, 2 / 1)' }}
                />
                <div className="flex flex-col gap-2 py-2">
                  <div className="flex justify-center mt-1">
                    <div className={`h-14 w-14 rounded-full ${SHAPE}`} />
                  </div>
                  <div className="flex flex-col items-center gap-1.5 px-4">
                    <div className={`h-4 w-3/4 rounded ${SHAPE}`} />
                    <div className={`h-4 w-1/2 rounded ${SHAPE}`} />
                  </div>
                  <div className="h-px bg-white/10 mx-3 mt-1" />
                  <div className="flex flex-col gap-2 px-4 py-1">
                    {[0, 1, 2].map(row => (
                      <div key={row} className="flex items-center justify-between">
                        <div className={`h-3 w-20 rounded ${SHAPE}`} />
                        <div className={`h-3 w-16 rounded ${SHAPE}`} />
                      </div>
                    ))}
                  </div>
                  <div className="h-px bg-white/10 mx-3" />
                  <div className="flex gap-2 px-3 py-2">
                    <div className={`flex-1 h-11 rounded-full ${SHAPE}`} />
                    <div className={`flex-1 h-11 rounded-full ${SHAPE}`} />
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

        {/* Mirror EmployerMobileShell <main class="p-3"> + inner responsive-container-wide.
            Real EmployerHome content uses `py-2 sm:py-3` — the outer p-3 already
            covers top/bottom on mobile, so no extra vertical padding here. */}
        <div className="flex-1 min-h-0 overflow-hidden p-3">
          <div className="responsive-container-wide space-y-3 sm:space-y-6">
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
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});

/**
 * Skeleton for /my-candidates — mirrors MyCandidatesHeader + mobile list.
 */
export const EmployerMyCandidatesSkeleton = memo(function EmployerMyCandidatesSkeleton() {
  const candidateCount = readCachedCount(SKELETON_COUNT_KEYS.myCandidates, 5);
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
          <div className="responsive-container-wide space-y-4">
            {/* Page title */}
            <div className="flex justify-center items-center mb-4">
              <div className={`h-7 w-40 rounded ${SHAPE}`} />
            </div>
            {/* Search + selection toggle */}
            <div className="flex items-center gap-2">
              <div className={`flex-1 h-11 rounded-xl ${SHAPE}`} />
              <div className={`h-11 w-11 rounded-xl ${SHAPE}`} />
            </div>
            {/* Stage filter pills (scrollable) */}
            <div className="flex gap-2 overflow-hidden">
              {[20, 24, 20, 28, 20].map((w, i) => (
                <div key={i} className={`h-9 w-${w} rounded-full ${SHAPE}`} style={{ width: `${w * 4}px` }} />
              ))}
            </div>
            {/* Candidate cards */}
            <div className="space-y-3">
              {Array.from({ length: candidateCount }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/20">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-full ${SHAPE}`} />
                    <div className="flex-1 space-y-2">
                      <div className={`h-4 w-2/3 rounded ${SHAPE}`} />
                      <div className={`h-3 w-1/2 rounded ${SHAPE}`} />
                    </div>
                    <div className={`h-6 w-16 rounded-full ${SHAPE}`} />
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

/**
 * Skeleton for /candidates — mirrors the page header, filters and candidate rows.
 */
export const EmployerCandidatesSkeleton = memo(function EmployerCandidatesSkeleton() {
  const candidateCount = readCachedCount(SKELETON_COUNT_KEYS.allCandidates, 5, 8);
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
          <div className="responsive-container-wide space-y-4">
            <div className="mb-6 flex flex-col items-center gap-2">
              <div className={`h-7 w-56 max-w-full rounded ${SHAPE}`} />
              <div className={`h-4 w-80 max-w-full rounded ${SHAPE}`} />
            </div>
            <div className="space-y-3">
              <div className={`h-11 w-full rounded-xl ${SHAPE}`} />
              <div className="flex justify-center gap-2">
                <div className={`h-9 w-40 rounded-full ${SHAPE}`} />
                <div className={`h-9 w-36 rounded-full ${SHAPE}`} />
              </div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: candidateCount }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className={`h-12 w-12 flex-shrink-0 rounded-full ${SHAPE}`} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className={`h-4 w-40 max-w-full rounded ${SHAPE}`} />
                    <div className={`h-3 w-24 rounded ${SHAPE}`} />
                    <div className={`h-3 w-56 max-w-full rounded ${SHAPE}`} />
                  </div>
                  <div className={`h-8 w-8 flex-shrink-0 rounded-full ${SHAPE}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});

/**
 * Skeleton for /messages — mirrors conversation list (mobile) / split view (desktop).
 */
export const EmployerMessagesSkeleton = memo(function EmployerMessagesSkeleton() {
  // Live-antal konversationer ur cachen → exakt lika många rader som listan
  // faktiskt renderar, clampat till vad som får plats i vyn.
  const messageCount = useLiveSkeletonCount({
    queryKeys: ['conversations'],
    fallbackKey: SKELETON_COUNT_KEYS.messages,
    cap: viewportRowCap(76),
  });
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
          <div className="responsive-container-wide space-y-4 h-full flex flex-col">
            {/* Header — mirrors Messages page icon/title group + optional new conversation action */}
            <div className="flex items-center justify-center flex-shrink-0 relative">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full ${SHAPE}`} />
                <div className="space-y-2">
                  <div className={`h-7 w-24 rounded ${SHAPE}`} />
                  <div className={`h-4 w-32 rounded ${SHAPE}`} />
                </div>
              </div>
              <div className={`absolute right-0 h-10 w-12 sm:w-40 rounded-lg ${SHAPE}`} />
            </div>
            <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
              <div className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col min-h-0">
                {/* Tabs */}
                <div className="flex justify-center gap-2 mb-3">
                  <div className={`h-9 w-20 rounded-full ${SHAPE}`} />
                  <div className={`h-9 w-24 rounded-full ${SHAPE}`} />
                  <div className={`h-9 w-24 rounded-full ${SHAPE}`} />
                </div>
                {/* Search */}
                <div className={`h-11 w-full rounded-xl mb-3 ${SHAPE}`} />
                {/* Conversation rows */}
                <div className="flex-1 space-y-2 rounded-xl border border-white/20 bg-white/5 p-2 overflow-hidden">
                  {Array.from({ length: messageCount }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03]">
                      <div className={`h-12 w-12 rounded-full ${SHAPE}`} />
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className={`h-4 w-1/2 rounded ${SHAPE}`} />
                        <div className={`h-3 w-3/4 rounded ${SHAPE}`} />
                      </div>
                      <div className={`h-3 w-10 rounded ${SHAPE}`} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden md:flex flex-1 min-w-0 rounded-xl border border-white/20 bg-white/5 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className={`h-14 w-14 rounded-full ${SHAPE}`} />
                  <div className={`h-5 w-48 rounded ${SHAPE}`} />
                  <div className={`h-4 w-64 rounded ${SHAPE}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});

/**
 * Skeleton for /company-profile — mirrors sections: logo, form fields, social media.
 */
export const EmployerCompanyProfileSkeleton = memo(function EmployerCompanyProfileSkeleton() {
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
          <div className="responsive-container-wide space-y-5">
            <div className="flex justify-center items-center mb-2">
              <div className={`h-7 w-48 rounded ${SHAPE}`} />
            </div>
            {/* Logo section */}
            <div className="flex flex-col items-center gap-3 py-4">
              <div className={`h-24 w-24 rounded-full ${SHAPE}`} />
              <div className={`h-4 w-32 rounded ${SHAPE}`} />
            </div>
            {/* Form fields */}
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="space-y-2">
                  <div className={`h-3 w-24 rounded ${SHAPE}`} />
                  <div className={`h-11 w-full rounded-lg ${SHAPE}`} />
                </div>
              ))}
              <div className="space-y-2">
                <div className={`h-3 w-32 rounded ${SHAPE}`} />
                <div className={`h-28 w-full rounded-lg ${SHAPE}`} />
              </div>
            </div>
            {/* Save button */}
            <div className={`h-11 w-full rounded-lg ${SHAPE}`} />
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});

/**
 * Skeleton for /employer-settings — mirrors panel/list layout.
 */
export const EmployerSettingsSkeleton = memo(function EmployerSettingsSkeleton() {
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
          <div className="responsive-container-wide space-y-4">
            <div className="flex justify-center items-center mb-2">
              <div className={`h-7 w-32 rounded ${SHAPE}`} />
            </div>
            {[1, 2, 3, 4].map(section => (
              <div key={section} className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-3">
                <div className={`h-5 w-40 rounded ${SHAPE}`} />
                <div className={`h-3 w-56 rounded ${SHAPE}`} />
                <div className="space-y-2 pt-2">
                  <div className={`h-11 w-full rounded-lg ${SHAPE}`} />
                  <div className={`h-11 w-full rounded-lg ${SHAPE}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </FullscreenSkeletonPortal>
  );
});

