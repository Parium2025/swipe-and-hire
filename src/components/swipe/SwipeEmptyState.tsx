import { memo } from 'react';
import { motion } from 'framer-motion';
import { Undo2 } from 'lucide-react';
import { SwipeHeader } from './SwipeHeader';

const ease = [0.22, 1, 0.36, 1] as const;

interface SwipeEmptyStateProps {
  onClose: () => void;
  hasFilter: boolean;
  activeFilterCount: number;
  onFilterOpen: () => void;
  canUndo?: boolean;
  onUndo?: () => void;
}

export const SwipeEmptyState = memo(function SwipeEmptyState({
  onClose,
  hasFilter,
  activeFilterCount,
  onFilterOpen,
  canUndo,
  onUndo,
}: SwipeEmptyStateProps) {
  return (
    <div className="fixed inset-0 z-[9999] bg-parium-gradient flex flex-col">
      <div className="relative h-[calc(72px+env(safe-area-inset-top,0px))] shrink-0">
        <SwipeHeader displayIndex={0} totalCount={0} onClose={onClose} hasFilter={hasFilter} activeFilterCount={activeFilterCount} onFilterOpen={onFilterOpen} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            opacity: { duration: 0.25, ease },
            scale: { duration: 0.25, ease },
          }}
          className="w-full max-w-[27rem] rounded-[1.75rem] border border-white/25 bg-primary/30 px-8 py-6 shadow-2xl"
        >
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease, delay: 0.05 }}
            className="text-center text-[15px] font-medium text-white sm:text-base"
          >
            {activeFilterCount > 0
              ? 'Inga jobb matchar dina filter just nu'
              : 'Inga jobb just nu'}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease, delay: 0.1 }}
            className="mt-2 text-center text-[13px] text-white sm:text-sm"
          >
            {activeFilterCount > 0
              ? 'Justera filtren och fortsätt leta.'
              : 'Fortsätt leta – nya jobb dyker upp hela tiden.'}
          </motion.p>

        </motion.div>

        {canUndo && onUndo && (
          <button
            type="button"
            onClick={onUndo}
            data-swipe-action-button
            className="flex items-center gap-2 h-11 px-5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg active:scale-[0.93] transition-transform touch-manipulation"
          >
            <Undo2 className="w-4.5 h-4.5 text-white" />
            <span className="text-sm text-white font-medium">Ångra</span>
          </button>
        )}
      </div>
    </div>
  );
});
