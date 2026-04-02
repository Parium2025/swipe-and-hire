import { memo } from 'react';

interface SwipeDotsProps {
  count: number;
  currentIndex: number;
  isEndStateActive: boolean;
}

export const SwipeDots = memo(function SwipeDots({
  count,
  currentIndex,
  isEndStateActive,
}: SwipeDotsProps) {
  if (count > 30) return null;

  return (
    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1">
      {Array.from({ length: count }).map((_, idx) => {
        const isActive = idx === currentIndex && !isEndStateActive;

        return (
          <div
            key={idx}
            className={`rounded-full transition-all duration-300 ${
              isActive ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/30'
            }`}
          />
        );
      })}
    </div>
  );
});