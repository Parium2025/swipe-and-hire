import { motion } from 'framer-motion';

type JobStatusTab = 'active' | 'expired';

interface JobStatusTabsProps {
  activeTab: JobStatusTab;
  onTabChange: (tab: JobStatusTab) => void;
  activeCount: number;
  expiredCount: number;
}

export function JobStatusTabs({ activeTab, onTabChange, activeCount, expiredCount }: JobStatusTabsProps) {
  return (
    <div className="relative flex bg-white/5 backdrop-blur-[2px] rounded-md p-1 border border-white/10 w-fit gap-0.5">
      {/* Sliding background */}
      <motion.div
        className="absolute top-1 bottom-1 bg-parium-navy rounded-[5px]"
        initial={false}
        animate={{
          left: activeTab === 'active' ? '4px' : 'calc(50% + 2px)',
          width: 'calc(50% - 6px)',
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
        type="button"
        onClick={() => onTabChange('active')}
        className="relative z-10 py-1 px-3 rounded-[5px] text-xs font-medium text-white transition-colors whitespace-nowrap"
      >
        Aktiva ({activeCount})
      </button>
      <button
        type="button"
        onClick={() => onTabChange('expired')}
        className="relative z-10 py-1 px-3 rounded-[5px] text-xs font-medium text-white transition-colors whitespace-nowrap"
      >
        Utgångna ({expiredCount})
      </button>
    </div>
  );
}
