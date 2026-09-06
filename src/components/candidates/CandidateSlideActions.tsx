import { memo } from 'react';
import { Bookmark, Info, Undo2, X } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';

interface CandidateSlideActionsProps {
  saved: boolean;
  canUndo?: boolean;
  onUndo?: () => void;
  onSave: () => void;
  onSkip: () => void;
  onOpenInfo: () => void;
}

/**
 * Åtgärdsrad i arbetsgivarens swipe-läge — samma form, storlek och känsla som
 * jobbsökarens [✕] [🔖] [❤] [↺], men med kandidatens åtgärder:
 * hoppa över, spara i lista, visa all info och ångra.
 *
 * Alla fyra knappar är alltid monterade så raden aldrig hoppar.
 */
export const CandidateSlideActions = memo(function CandidateSlideActions({
  saved,
  canUndo,
  onUndo,
  onSave,
  onSkip,
  onOpenInfo,
}: CandidateSlideActionsProps) {
  const undoActive = Boolean(canUndo && onUndo);

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label="Hoppa över kandidaten"
        onPointerDown={(e) => {
          e.stopPropagation();
          onSkip();
        }}
        onClick={(e) => e.preventDefault()}
        data-swipe-action-button
        className="w-[52px] h-[52px] rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-[0.93] transition-transform touch-manipulation"
      >
        <X className="w-6 h-6 text-white" strokeWidth={2.5} />
      </button>

      <button
        type="button"
        aria-label={saved ? 'Kandidaten finns redan i en lista' : 'Spara kandidaten i en lista'}
        aria-pressed={saved}
        aria-disabled={saved}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (saved) return;
          hapticLight();
          onSave();
        }}
        onClick={(e) => e.preventDefault()}
        data-swipe-action-button
        className={`w-[52px] h-[52px] rounded-full bg-secondary border border-white/25 flex items-center justify-center shadow-lg shadow-secondary/30 transition-transform touch-manipulation ${
          saved ? 'opacity-60' : 'active:scale-[0.93]'
        }`}
      >
        <Bookmark
          className={`w-6 h-6 ${saved ? 'text-white fill-white' : 'text-white'}`}
          strokeWidth={saved ? 2 : 2.25}
        />
      </button>

      <button
        type="button"
        aria-label="Visa all information om kandidaten"
        onPointerDown={(e) => {
          e.stopPropagation();
          onOpenInfo();
        }}
        onClick={(e) => e.preventDefault()}
        data-swipe-action-button
        className="w-[52px] h-[52px] rounded-full bg-success flex items-center justify-center shadow-lg active:scale-[0.93] transition-transform touch-manipulation"
      >
        <Info className="w-6 h-6 text-white" strokeWidth={2.25} />
      </button>

      <button
        type="button"
        aria-label="Ångra senaste åtgärd"
        aria-disabled={!undoActive}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (undoActive) onUndo!();
        }}
        onClick={(e) => e.preventDefault()}
        data-swipe-action-button
        className="w-[52px] h-[52px] rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg active:scale-[0.93] transition-all touch-manipulation"
      >
        <Undo2
          className={`w-6 h-6 text-white transition-opacity duration-200 ${undoActive ? 'opacity-100' : 'opacity-40'}`}
          strokeWidth={2.25}
        />
      </button>
    </div>
  );
});

export default CandidateSlideActions;
