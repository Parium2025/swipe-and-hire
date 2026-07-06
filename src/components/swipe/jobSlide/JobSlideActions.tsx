import { memo } from 'react';
import { Bookmark, Heart, Undo2, X } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';

interface JobSlideActionsProps {
  saved: boolean;
  canUndo?: boolean;
  onUndo?: () => void;
  onSave: () => void;
  onDislike: () => void;
  onLike: () => void;
}

/**
 * Bottom action bar: [✕ dislike] [🔖 save] [❤ like] [↺ undo].
 *
 * Alla fyra knappar är ALLTID monterade (preload-känsla). Ångra-knappens
 * ikon dimmas via opacity när canUndo=false — själva knappen står kvar
 * på plats, exakt som ✕/spara/❤. Det här är hela poängen med att inte
 * villkora renderingen.
 */
export const JobSlideActions = memo(function JobSlideActions({
  saved,
  canUndo,
  onUndo,
  onSave,
  onDislike,
  onLike,
}: JobSlideActionsProps) {
  const undoActive = Boolean(canUndo && onUndo);

  return (
    <div className="absolute inset-x-0 bottom-4 z-10 px-5">
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label="Nej tack, hoppa över jobbet"
          onPointerDown={(e) => {
            e.stopPropagation();
            onDislike();
          }}
          onClick={(e) => e.preventDefault()}
          data-swipe-action-button
          className="w-[52px] h-[52px] rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-[0.93] transition-transform touch-manipulation"
        >
          <X className="w-6 h-6 text-white" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          aria-label={saved ? 'Ta bort från sparade jobb' : 'Spara jobbet'}
          aria-pressed={saved}
          onPointerDown={(e) => {
            e.stopPropagation();
            hapticLight();
            onSave();
          }}
          onClick={(e) => e.preventDefault()}
          data-swipe-action-button
          className="w-[52px] h-[52px] rounded-full bg-secondary border border-white/25 flex items-center justify-center shadow-lg shadow-secondary/30 active:scale-[0.93] transition-transform touch-manipulation"
        >
          <Bookmark
            className={`w-6 h-6 ${saved ? 'text-white fill-white' : 'text-white'}`}
            strokeWidth={saved ? 2 : 2.25}
          />
        </button>
        <button
          type="button"
          aria-label="Sök jobbet"
          onPointerDown={(e) => {
            e.stopPropagation();
            onLike();
          }}
          onClick={(e) => e.preventDefault()}
          data-swipe-action-button
          className="w-[52px] h-[52px] rounded-full bg-success flex items-center justify-center shadow-lg active:scale-[0.93] transition-transform touch-manipulation"
        >
          <Heart className="w-6 h-6 text-white fill-white" />
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
          className="w-[52px] h-[52px] rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg active:scale-[0.93] transition-all touch-manipulation opacity-100"
        >
          <Undo2
            className={`w-6 h-6 text-white transition-opacity duration-200 ${undoActive ? 'opacity-100' : 'opacity-40'}`}
            strokeWidth={2.25}
          />
        </button>
      </div>
    </div>
  );
});
