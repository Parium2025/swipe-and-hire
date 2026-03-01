import { motion } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

type JobStatusTab = 'active' | 'expired' | 'draft';

interface JobStatusTabsProps {
  activeTab: JobStatusTab;
  onTabChange: (tab: JobStatusTab) => void;
  activeCount: number;
  expiredCount: number;
  draftCount?: number;
  showDrafts?: boolean;
}

export function JobStatusTabs({ activeTab, onTabChange, activeCount, expiredCount, draftCount, showDrafts = false }: JobStatusTabsProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const expiredRef = useRef<HTMLButtonElement>(null);
  const draftRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 4, width: 0 });

  useEffect(() => {
    const updateIndicator = () => {
      const refs: Record<JobStatusTab, React.RefObject<HTMLButtonElement>> = {
        active: activeRef,
        expired: expiredRef,
        draft: draftRef,
      };
      const ref = refs[activeTab]?.current;
      if (ref) {
        setIndicatorStyle({
          left: ref.offsetLeft,
          width: ref.offsetWidth,
        });
      }
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeTab, activeCount, expiredCount, draftCount]);

  return (
    <div className="relative flex bg-white/5 backdrop-blur-[2px] rounded-md p-1 border border-white/10 w-fit gap-0.5 mx-auto">
      {/* Sliding background */}
      <motion.div
        className="absolute top-1 bottom-1 bg-parium-navy rounded-[5px]"
        initial={false}
        animate={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 35,
          mass: 0.8,
        }}
      />
      
      {/* Buttons */}
      <button
        ref={activeRef}
        type="button"
        onClick={() => onTabChange('active')}
        className="relative z-10 py-1 px-3 rounded-[5px] text-xs font-medium text-white transition-colors whitespace-nowrap"
      >
        Aktiva ({activeCount})
      </button>
      <button
        ref={expiredRef}
        type="button"
        onClick={() => onTabChange('expired')}
        className="relative z-10 py-1 px-3 rounded-[5px] text-xs font-medium text-white transition-colors whitespace-nowrap"
      >
        Utgångna ({expiredCount})
      </button>
      {showDrafts && (
        <button
          ref={draftRef}
          type="button"
          onClick={() => onTabChange('draft')}
          className="relative z-10 py-1 px-3 rounded-[5px] text-xs font-medium text-white transition-colors whitespace-nowrap"
        >
          Utkast ({draftCount ?? 0})
        </button>
      )}
    </div>
  );
}
