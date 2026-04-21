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
  const [hasMeasured, setHasMeasured] = useState(false);

  const updateIndicator = useCallback(() => {
    const refs: Record<JobStatusTab, React.RefObject<HTMLButtonElement>> = {
      active: activeRef,
      expired: expiredRef,
      draft: draftRef,
    };
    const ref = refs[activeTab]?.current;
    if (ref && ref.offsetWidth > 0) {
      setIndicatorStyle({
        x: ref.offsetLeft,
        width: ref.offsetWidth,
      });
      setHasMeasured(true);
    }
  }, [activeTab]);

  useLayoutEffect(() => {
    updateIndicator();
    // Multipla retries — fonts/layout kan vara osettlade vid mount,
    // särskilt när komponenten mountas via tab-byte i parent (Dashboard ↔ Mina annonser)
    const raf1 = requestAnimationFrame(() => {
      updateIndicator();
      const raf2 = requestAnimationFrame(updateIndicator);
      return () => cancelAnimationFrame(raf2);
    });
    const fallback1 = setTimeout(updateIndicator, 50);
    const fallback2 = setTimeout(updateIndicator, 200);
    window.addEventListener('resize', updateIndicator);

    // ResizeObserver fångar layout-shifts från fonts/parent-container
    const ro = new ResizeObserver(updateIndicator);
    if (railRef.current) ro.observe(railRef.current);
    if (activeRef.current) ro.observe(activeRef.current);
    if (expiredRef.current) ro.observe(expiredRef.current);
    if (draftRef.current) ro.observe(draftRef.current);

    return () => {
      window.removeEventListener('resize', updateIndicator);
      cancelAnimationFrame(raf1);
      clearTimeout(fallback1);
      clearTimeout(fallback2);
      ro.disconnect();
    };
  }, [updateIndicator, activeCount, expiredCount, draftCount, showDrafts]);

  return (
    <div className="dashboard-tabs-viewport mx-auto">
      <div ref={railRef} className="dashboard-tabs-rail relative bg-white/5 border border-white/10 mx-auto">
        {/* Sliding background — uses GPU-accelerated transform instead of layout-triggering left */}
        <motion.div
          className="absolute top-1 bottom-1 bg-parium-navy rounded-[7px] will-change-transform"
          style={{
            width: indicatorStyle.width,
            left: 0,
            // Dölj tills vi har en giltig mätning — undviker "osynlig indikator vid mount"
            opacity: hasMeasured ? 1 : 0,
          }}
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
