import { memo } from 'react';
import { Bookmark, Heart, Undo2, X } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';

interface SwipeActionsBarProps {
  saved: boolean;
  canUndo?: boolean;
  visible?: boolean;
  onUndo?: () => void;
  onSave: () => void;
  onDislike: () => void;
  onLike: () => void;
}

/**
 * Persistent bottom action bar för Swipe Mode — [✕] [🔖] [❤] [↺].
 *
 * Renderas ovanför kortstacken i `SwipeFullscreen` (INTE inuti varje `JobSlide`),
 * så knapparna står stilla mellan kort. Detta gör att "Ångra"-knappen redan
 * är på plats i samma sekund som ett kort nekas — den bleknar aldrig in
 * tillsammans med nästa kort.
 *
 * Positionering: `absolute` inuti swipe-portalens fixed-container. Bottnen
 * matchar exakt originalpositionen från JobSlideActions
 * (safe-area + card padding 1.25rem + card innermarginal 1rem = 2.25rem).
 * Layout, storlek, färger och haptik är oförändrade.
 */
export const SwipeActionsBar = memo(function SwipeActionsBar({
  saved,
  canUndo,
  visible = true,
  onUndo,
  onSave,
  onDislike,
  onLike,
}: SwipeActionsBarProps) {
  const undoActive = Boolean(canUndo && onUndo);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 px-5"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.25rem)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 180ms ease-out',
      }}
      aria-hidden={!visible}
    >
      <div className="flex items-center justify-center gap-4 pointer-events-auto">
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
