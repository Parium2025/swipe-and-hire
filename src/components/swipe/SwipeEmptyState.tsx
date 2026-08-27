import { memo } from 'react';
import { motion } from 'framer-motion';
import { X, SlidersHorizontal, Undo2 } from 'lucide-react';

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
      {/* Header — identisk layout som SwipeHeader (räknare vänster,
          filter absolut centrerad, X höger) så att "Visa filter" inte
          hoppar när sista jobbet swipas bort. */}
      <div className="relative">
        <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
          <div className="py-3">
            <span className="text-xs text-white font-medium tabular-nums">0 / 0</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center touch-manipulation"
            aria-label="Stäng"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors">
              <X className="h-5 w-5 text-white" />
            </div>
          </button>
        </div>

        {hasFilter && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 pt-[env(safe-area-inset-top,0px)] pointer-events-none">
            <div className="py-3">
              <button
                onClick={onFilterOpen}
                className="pointer-events-auto relative flex items-center gap-2 h-12 px-6 rounded-full bg-white/10 border border-white/20 active:scale-[0.97] transition-colors touch-manipulation"
                aria-label="Visa filter"
              >
                <SlidersHorizontal className="h-4.5 w-4.5 text-white" />
                <span className="text-[15px] text-white font-medium">Visa filter</span>
                {activeFilterCount > 0 && (
                  <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-secondary text-white text-[11px] font-bold leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
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
