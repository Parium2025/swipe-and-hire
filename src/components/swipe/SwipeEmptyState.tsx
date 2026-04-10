import { memo } from 'react';
import { X, SlidersHorizontal, Undo2 } from 'lucide-react';

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
      <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="py-3">
          <span className="text-xs text-white font-medium tabular-nums">0 / 0</span>
        </div>
        {hasFilter && (
          <button
            onClick={onFilterOpen}
            className="flex items-center gap-2 h-12 px-6 rounded-full bg-white/10 border border-white/20 active:scale-[0.97] transition-colors touch-manipulation"
          >
            <SlidersHorizontal className="h-4.5 w-4.5 text-white" />
            <span className="text-[15px] text-white font-medium">Visa filter</span>
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-secondary text-white text-[11px] font-bold leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
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

      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
        <div className="bg-white/10 rounded-2xl px-8 py-5 border border-white/20">
          <p className="text-white text-base font-medium text-center">Inga jobb hittades</p>
        </div>

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
