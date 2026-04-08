import { memo } from 'react';
import { Sparkles } from 'lucide-react';

interface SwipeModeToggleProps {
  onActivate: () => void;
}

export const SwipeModeToggle = memo(function SwipeModeToggle({ onActivate }: SwipeModeToggleProps) {
  return (
    <div className="flex justify-center mb-4">
      <button
        onClick={onActivate}
        className="h-11 px-6 flex items-center gap-2 bg-secondary border border-secondary/40 rounded-full text-white font-medium transition-colors hover:bg-secondary/90 shadow-lg shadow-secondary/30 will-change-transform"
        style={{ transform: 'translateZ(0)' }}
      >
        <Sparkles className="w-4 h-4" />
        Swipe Mode
      </button>
    </div>
  );
});
