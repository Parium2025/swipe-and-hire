import { Button } from '@/components/ui/button';
import { memo } from 'react';
import { Sparkles } from 'lucide-react';

interface SwipeModeToggleProps {
  onActivate: () => void;
}

export const SwipeModeToggle = memo(function SwipeModeToggle({ onActivate }: SwipeModeToggleProps) {
  return (
    <div className="flex justify-center mb-4">
      <Button
        onClick={onActivate}
        variant="glass"
        size="default"
        className="px-6"
      >
        <Sparkles className="w-4 h-4" />
        Swipe Mode
      </Button>
    </div>
  );
});
