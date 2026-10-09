import { memo } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <div className="absolute top-0 left-0 right-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex h-12 items-center my-3">
          <span className="text-xs text-pure-white font-medium tabular-nums">
            {displayIndex} / {totalCount}
          </span>
        </div>
        {hasFilter ? (
            <Button
              variant="glass"
              onClick={onFilterOpen}
              className="relative my-3 h-12 min-h-12 px-6 text-pure-white"
              aria-label="Visa filter"
            >
              <SlidersHorizontal className="!h-4.5 !w-4.5" />
              <span className="text-[15px] font-medium">Visa filter</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-secondary text-secondary-foreground text-[11px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </Button>
        ) : <div />}
        <div className="my-3 flex h-12 justify-end">
          <Button
            variant="outlineNeutral"
            size="icon"
            onClick={onClose}
            className="h-12 w-12 min-h-12 border-0 rounded-full text-pure-white touch-manipulation"
            aria-label="Stäng"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pure-white/10 [@media(hover:hover)]:hover:bg-pure-white/20 transition-colors">
              <X className="!h-5 !w-5" />
            </div>
          </Button>
        </div>
      </div>
  );
});