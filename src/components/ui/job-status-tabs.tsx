import { motion } from 'framer-motion';
import { memo } from 'react';

type JobStatusTab = 'active' | 'expired' | 'draft';

interface JobStatusTabsProps {
  activeTab: JobStatusTab;
  onTabChange: (tab: JobStatusTab) => void;
  activeCount: number;
  expiredCount: number;
  draftCount?: number;
  showDrafts?: boolean;
}

const tabColors: Record<JobStatusTab, string> = {
  active: 'text-green-400',
  expired: 'text-red-400',
  draft: 'text-amber-400',
};

/**
 * Tab switcher with a sliding indicator.
 *
 * Performance design — mirrors InterviewTypeTabs (Video/Kontor) which feels instant:
 *  - Buttons live in a CSS Grid with N equal columns.
 *  - Indicator is positioned with `left/width` as percentages of the rail and
 *    moved with `transform: translateX(N * 100%)`.
 *  - Zero DOM measurement: no refs, no offsetLeft/offsetWidth, no useLayoutEffect,
 *    no resize listener, no setState during animation.
 *  - The animation is a pure GPU transform, so it never has to wait for React
 *    commits, layout reads, or job-card re-renders that happen on tab change.
 */
export const JobStatusTabs = memo(function JobStatusTabs({
  activeTab,
  onTabChange,
  activeCount,
  expiredCount,
  draftCount,
  showDrafts = false,
}: JobStatusTabsProps) {
  const tabs: JobStatusTab[] = showDrafts ? ['active', 'expired', 'draft'] : ['active', 'expired'];
  const activeIndex = Math.max(0, tabs.indexOf(activeTab));
  const columnCount = tabs.length;
  // Each grid column = 100% / columnCount of the rail's content box.
  // Move indicator by `activeIndex` columns (translateX in % is relative to its own width).
  const indicatorXPercent = activeIndex * 100;

  return (
    <div className="dashboard-tabs-viewport mx-auto">
      <div
        className="dashboard-tabs-rail relative bg-white/5 border border-white/10 mx-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gap: 0,
        }}
      >
        {/* Sliding background — pure transform animation, no DOM measurement. */}
        <motion.div
          className="absolute top-1 bottom-1 bg-parium-navy rounded-[7px] pointer-events-none will-change-transform"
          style={{
            left: 0,
            width: `${100 / columnCount}%`,
          }}
          initial={false}
          animate={{ x: `${indicatorXPercent}%` }}
          transition={{
            type: 'spring',
            stiffness: 320,
            damping: 34,
            mass: 0.7,
          }}
        />

        {/* Buttons — each lives in one grid column => identical widths. */}
        <button
          type="button"
          onClick={() => onTabChange('active')}
          className={`dashboard-tab-button relative z-10 rounded-[7px] font-medium transition-colors whitespace-nowrap ${tabColors.active}`}
        >
          Aktiva ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => onTabChange('expired')}
          className={`dashboard-tab-button relative z-10 rounded-[7px] font-medium transition-colors whitespace-nowrap ${tabColors.expired}`}
        >
          Utgångna ({expiredCount})
        </button>
        {showDrafts && (
          <button
            type="button"
            onClick={() => onTabChange('draft')}
            className={`dashboard-tab-button relative z-10 rounded-[7px] font-medium transition-colors whitespace-nowrap ${tabColors.draft}`}
          >
            Utkast ({draftCount ?? 0})
          </button>
        )}
      </div>
    </div>
  );
});
