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
 * Performance design:
 *  - Buttons live inside a CSS Grid with equal-width columns. The indicator
 *    occupies one full column and is moved with `transform: translateX(N * 100%)`.
 *  - This avoids ALL DOM measurement (no refs, no offsetLeft/offsetWidth, no
 *    useLayoutEffect, no resize listeners). The animation is pure GPU
 *    transform — same pattern as InterviewTypeTabs (Video/Kontor) which feels
 *    instant. The animation never has to wait for React commits or layout reads
 *    while the rest of the dashboard re-renders job cards.
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
  // The indicator is one column wide; move it by N column widths (= N * 100%).
  const indicatorXPercent = activeIndex * 100;

  return (
    <div className="dashboard-tabs-viewport mx-auto">
      <div
        className="dashboard-tabs-rail relative bg-white/5 border border-white/10 mx-auto grid"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
      >
        {/* Sliding background — pure transform animation, no DOM measurement. */}
        <motion.div
          className="absolute top-1 bottom-1 bg-parium-navy rounded-[7px] pointer-events-none will-change-transform"
          style={{
            left: '0.25rem',
            width: `calc((100% - 0.5rem) / ${columnCount})`,
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

        {/* Buttons (each lives in one grid column => identical widths). */}
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
