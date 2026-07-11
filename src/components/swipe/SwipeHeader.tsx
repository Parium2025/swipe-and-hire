import { memo } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';

interface SwipeHeaderProps {
  displayIndex: number;
  totalCount: number;
  hasFilter: boolean;
  activeFilterCount: number;
  onFilterOpen: () => void;
  onClose: () => void;
}

export const SwipeHeader = memo(function SwipeHeader({
  displayIndex,
  totalCount,
  hasFilter,
  activeFilterCount,
  onFilterOpen,
  onClose,
}: SwipeHeaderProps) {
  return (
    <>
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="py-3">
          <span className="text-xs text-white font-medium tabular-nums">
            {displayIndex} / {totalCount}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center touch-manipulation"
          aria-label="Stäng"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 [@media(hover:hover)]:hover:bg-white/20 transition-colors">
            <X className="h-5 w-5 text-white" />
          </div>
        </button>
      </div>

      {hasFilter && (
        <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2 pt-[env(safe-area-inset-top,0px)] pointer-events-none">
          <div className="py-3">
            <button
              onClick={onFilterOpen}
              className="pointer-events-auto relative flex items-center gap-2 h-12 px-6 rounded-full bg-white/10 border border-white/20 [@media(hover:hover)]:hover:bg-white/20 transition-colors active:scale-[0.97] touch-manipulation"
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
    </>
  );
});