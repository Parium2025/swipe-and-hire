import { motion } from 'framer-motion';
import { memo, useRef, useState, useLayoutEffect, useCallback } from 'react';

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

export const JobStatusTabs = memo(function JobStatusTabs({ activeTab, onTabChange, activeCount, expiredCount, draftCount, showDrafts = false }: JobStatusTabsProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const expiredRef = useRef<HTMLButtonElement>(null);
  const draftRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ x: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const refs: Record<JobStatusTab, React.RefObject<HTMLButtonElement>> = {
      active: activeRef,
      expired: expiredRef,
      draft: draftRef,
    };
    const ref = refs[activeTab]?.current;
    if (ref) {
      setIndicatorStyle({
        x: ref.offsetLeft,
        width: ref.offsetWidth,
      });
    }
  }, [activeTab]);

  useLayoutEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator, activeCount, expiredCount, draftCount]);

  return (
    <div className="dashboard-tabs-viewport mx-auto">
      <div ref={railRef} className="dashboard-tabs-rail relative bg-white/5 border border-white/10 mx-auto">
        {/* Sliding background — uses GPU-accelerated transform instead of layout-triggering left */}
        <motion.div
          className="absolute top-1 bottom-1 bg-parium-navy rounded-[7px] will-change-transform"
          style={{ width: indicatorStyle.width, left: 0 }}
          initial={false}
          animate={{ x: indicatorStyle.x }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 34,
            mass: 0.6,
          }}
        />
        
        {/* Buttons */}
        <button
          ref={activeRef}
          type="button"
          onClick={() => onTabChange('active')}
          className="dashboard-tab-button relative z-10 rounded-[7px] font-medium text-white transition-colors whitespace-nowrap"
        >
          Aktiva ({activeCount})
        </button>
        <button
          ref={expiredRef}
          type="button"
          onClick={() => onTabChange('expired')}
          className="dashboard-tab-button relative z-10 rounded-[7px] font-medium text-white transition-colors whitespace-nowrap"
        >
          Utgångna ({expiredCount})
        </button>
        {showDrafts && (
          <button
            ref={draftRef}
            type="button"
            onClick={() => onTabChange('draft')}
            className="dashboard-tab-button relative z-10 rounded-[7px] font-medium text-white transition-colors whitespace-nowrap"
          >
            Utkast ({draftCount ?? 0})
          </button>
        )}
      </div>
    </div>
  );
});
