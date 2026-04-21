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
    // Ensure measurement after fonts/layout settle
    const raf = requestAnimationFrame(updateIndicator);
    const fallback = setTimeout(updateIndicator, 100);
    window.addEventListener('resize', updateIndicator);
    return () => {
      window.removeEventListener('resize', updateIndicator);
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [updateIndicator, activeCount, expiredCount, draftCount]);

  return (
    <div className="dashboard-tabs-viewport mx-auto">
      <div ref={railRef} className="dashboard-tabs-rail relative bg-white/5 border border-white/10 mx-auto">
        {/* Sliding background — animates x AND width together for smooth tab transitions */}
        <motion.div
          className="absolute top-1 bottom-1 bg-parium-navy rounded-[7px] will-change-transform"
          style={{ left: 0, transform: 'translateZ(0)' }}
          initial={false}
          animate={{ x: indicatorStyle.x, width: indicatorStyle.width }}
          transition={{
            type: 'tween',
            duration: 0.22,
            ease: [0.32, 0.72, 0, 1],
          }}
        />
        
        {/* Buttons */}
        <button
          ref={activeRef}
          type="button"
          onClick={() => onTabChange('active')}
          className={`dashboard-tab-button relative z-10 rounded-[7px] font-medium transition-colors whitespace-nowrap ${tabColors.active}`}
        >
          Aktiva ({activeCount})
        </button>
        <button
          ref={expiredRef}
          type="button"
          onClick={() => onTabChange('expired')}
          className={`dashboard-tab-button relative z-10 rounded-[7px] font-medium transition-colors whitespace-nowrap ${tabColors.expired}`}
        >
          Utgångna ({expiredCount})
        </button>
        {showDrafts && (
          <button
            ref={draftRef}
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
