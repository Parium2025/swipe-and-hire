import { motion } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

type JobStatusTab = 'active' | 'expired';

interface JobStatusTabsProps {
  activeTab: JobStatusTab;
  onTabChange: (tab: JobStatusTab) => void;
  activeCount: number;
  expiredCount: number;
}

export function JobStatusTabs({ activeTab, onTabChange, activeCount, expiredCount }: JobStatusTabsProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const expiredRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 4, width: 0 });

  useEffect(() => {
    const updateIndicator = () => {
      const activeButton = activeRef.current;
      const expiredButton = expiredRef.current;
      
      if (activeTab === 'active' && activeButton) {
        setIndicatorStyle({
          left: activeButton.offsetLeft,
          width: activeButton.offsetWidth,
        });
      } else if (activeTab === 'expired' && expiredButton) {
        setIndicatorStyle({
          left: expiredButton.offsetLeft,
          width: expiredButton.offsetWidth,
        });
      }
    };

    updateIndicator();
    // Update on resize
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeTab, activeCount, expiredCount]);

  return (
    <div className="relative flex bg-white/5 backdrop-blur-[2px] rounded-md p-1 border border-white/10 w-fit gap-0.5">
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
    </div>
  );
}
