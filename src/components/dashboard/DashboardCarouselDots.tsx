import { memo } from 'react';
import { cn } from '@/lib/utils';

interface DashboardCarouselDotsProps {
  count: number;
  currentIndex: number;
  onSelect: (index: number) => void;
  label: string;
  alwaysRender?: boolean;
}

export const DashboardCarouselDots = memo(({ count, currentIndex, onSelect, label, alwaysRender = false }: DashboardCarouselDotsProps) => {
  if (!alwaysRender && count <= 1) return null;

  return (
    <div className="h-6 flex items-center justify-center mt-auto shrink-0">
      <div className="flex items-center gap-1.5 leading-none">
        {Array.from({ length: count }).map((_, i) => (
          <button
            type="button"
            key={i}
            onClick={() => onSelect(i)}
            className={cn(
              "block flex-none p-0 m-0 border-0 appearance-none w-2.5 h-2.5 rounded-full touch-manipulation transition-none align-middle",
              i === currentIndex ? "bg-white" : "bg-white/30"
            )}
            aria-label={`${label} ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
});

DashboardCarouselDots.displayName = 'DashboardCarouselDots';