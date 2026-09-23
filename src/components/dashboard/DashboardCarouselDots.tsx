import { memo } from 'react';
import { cn } from '@/lib/utils';

interface DashboardCarouselDotsProps {
  count: number;
  currentIndex: number;
  onSelect: (index: number) => void;
  label: string;
  alwaysRender?: boolean;
  maxVisible?: number;
}

export const DashboardCarouselDots = memo(({ count, currentIndex, onSelect, label, alwaysRender = false, maxVisible }: DashboardCarouselDotsProps) => {
  if (!alwaysRender && count <= 1) return null;

  const visibleCount = Math.min(count, Math.max(1, maxVisible ?? count));
  const maxStartIndex = Math.max(0, count - visibleCount);
  const startIndex = Math.min(
    Math.max(0, currentIndex - Math.floor((visibleCount - 1) / 2)),
    maxStartIndex,
  );
  const visibleIndexes = Array.from({ length: visibleCount }, (_, index) => startIndex + index);

  const dots = (
    <div className="flex items-center gap-1.5 leading-none">
      {visibleIndexes.map((index) => (
        <button
          type="button"
          key={index}
          onClick={() => onSelect(index)}
          className={cn(
            "block flex-none p-0 m-0 border-0 appearance-none w-2.5 h-2.5 rounded-full touch-manipulation transition-none align-middle",
            index === currentIndex ? "bg-white" : "bg-white/30"
          )}
          aria-label={`${label} ${index + 1}`}
        />
      ))}
    </div>
  );

  return (
    <div className="h-6 flex items-center justify-center mt-auto shrink-0">
      {dots}
    </div>
  );
});

DashboardCarouselDots.displayName = 'DashboardCarouselDots';