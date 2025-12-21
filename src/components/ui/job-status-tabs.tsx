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
    <div className="relative flex bg-white/5 backdrop-blur-[2px] rounded-lg p-1.5 border border-white/20 w-fit gap-1">
      {/* Sliding background */}
      <motion.div
        className="absolute top-1.5 bottom-1.5 bg-parium-navy rounded-md"
        initial={false}
        animate={{
          left: activeTab === 'active' ? '6px' : 'calc(50% + 2px)',
          width: 'calc(50% - 8px)',
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
        className="relative z-10 py-2 px-5 rounded-md text-sm font-medium text-white transition-colors whitespace-nowrap"
      >
        Aktiva ({activeCount})
      </button>
      <button
        type="button"
        onClick={() => onTabChange('expired')}
        className="relative z-10 py-2 px-5 rounded-md text-sm font-medium text-white transition-colors whitespace-nowrap"
      >
        Utgångna ({expiredCount})
      </button>
    </div>
  );
}
