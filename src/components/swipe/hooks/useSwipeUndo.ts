import { useCallback, useEffect, useRef, useState } from 'react';
import { hapticSuccess } from '@/lib/haptics';

interface UseSwipeUndoOptions {
  /**
   * Callback som återinsätter jobbet i föräldrarens jobs-array. När denna
   * är undefined är Ångra permanent avstängd (t.ex. i preview-läge).
   */
  onUndoSwipeAction?: (jobId: string) => void;
}

/**
 * Centraliserar ALL undo-relaterad state:
 *  - `undoStackRef`  — LIFO av senaste skippade job-id (ref, inga re-renders).
 *  - `canUndo`       — derived boolean, exponeras för UI.
 *  - `undoEntryJobId` — det jobb som just återkommit; används av JobSlide för
 *    catch-animation. Rensas efter 700 ms.
 *  - `pendingUndoJobIdRef` — läses av jobs-effekten i containern så att den
 *    snappar till rätt kortposition efter att föräldern muterat arrayen.
 *
 * VIKTIGT: 700 ms-timern städas i unmount-effekten — annars kunde en
 * orphaned setTimeout sätta state på en avmonterad komponent om användaren
 * stängde swipe-mode inom fönstret.
 */
export function useSwipeUndo({ onUndoSwipeAction }: UseSwipeUndoOptions) {
  const undoStackRef = useRef<string[]>([]);
  const pendingUndoJobIdRef = useRef<string | null>(null);
  const undoEntryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [undoEntryJobId, setUndoEntryJobId] = useState<string | null>(null);

  const pushSkipped = useCallback((jobId: string) => {
    undoStackRef.current = [...undoStackRef.current, jobId];
    setCanUndo(true);
  }, []);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0 || !onUndoSwipeAction) return;

    const lastId = stack[stack.length - 1];
    pendingUndoJobIdRef.current = lastId;
    setUndoEntryJobId(lastId);
    onUndoSwipeAction(lastId);
    undoStackRef.current = stack.slice(0, -1);
    setCanUndo(undoStackRef.current.length > 0);
    hapticSuccess();

    if (undoEntryTimerRef.current) clearTimeout(undoEntryTimerRef.current);
    undoEntryTimerRef.current = setTimeout(() => {
      setUndoEntryJobId(null);
      undoEntryTimerRef.current = null;
    }, 700);
  }, [onUndoSwipeAction]);

  useEffect(() => {
    return () => {
      if (undoEntryTimerRef.current) clearTimeout(undoEntryTimerRef.current);
    };
  }, []);

  return {
    canUndo: canUndo && !!onUndoSwipeAction,
    undoEntryJobId,
    pendingUndoJobIdRef: pendingUndoJobIdRef as MutableRefObject<string | null>,
    pushSkipped,
    handleUndo,
  };
}
