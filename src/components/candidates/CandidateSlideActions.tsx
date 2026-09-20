import { memo } from 'react';
import { Bookmark, Info, RotateCcw, X } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';

interface CandidateSlideActionsProps {
  saved: boolean;
  onSave: () => void;
  onSkip: () => void;
  onOpenInfo: () => void;
  canUndo: boolean;
  onUndo: () => void;
}

/**
 * Åtgärdsrad i arbetsgivarens swipe-läge — samma form, storlek och känsla som
 * jobbsökarens [✕] [🔖] [ℹ] [↺], men med kandidatens åtgärder:
 * hoppa över, spara i lista, visa all info och ångra senaste svep.
 *
 * Knapparna är alltid monterade så raden aldrig hoppar. Spara går alltid att
 * trycka på — även för en redan sparad kandidat — så listväljaren kan öppnas
 * igen och kandidaten flyttas eller läggas i fler listor.
 */
export const CandidateSlideActions = memo(function CandidateSlideActions({
  saved,
  onSave,
  onSkip,
  onOpenInfo,
  canUndo,
  onUndo,
}: CandidateSlideActionsProps) {
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
        aria-label={saved ? 'Kandidaten är sparad — hantera listor' : 'Spara kandidaten i en lista'}
        aria-pressed={saved}
        onPointerDown={(e) => {
          e.stopPropagation();
          hapticLight();
          onSave();
        }}
        onClick={(e) => e.preventDefault()}
        data-swipe-action-button
        className="w-[52px] h-[52px] rounded-full bg-secondary border border-white/25 flex items-center justify-center shadow-lg shadow-secondary/30 transition-transform touch-manipulation active:scale-[0.93]"
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
        aria-label="Ångra senaste svep"
        aria-disabled={!canUndo}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!canUndo) return;
          hapticLight();
          onUndo();
        }}
        onClick={(e) => e.preventDefault()}
        data-swipe-action-button
        className={`w-[52px] h-[52px] rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-lg transition-transform touch-manipulation ${
          canUndo ? 'active:scale-[0.93]' : 'opacity-40'
        }`}
      >
        <RotateCcw className="w-6 h-6 text-white" strokeWidth={2.25} />
      </button>
    </div>
  );
});

export default CandidateSlideActions;
