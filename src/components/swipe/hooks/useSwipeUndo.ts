import { useCallback, useEffect, useRef, useState } from 'react';
import { hapticSuccess } from '@/lib/haptics';

interface UseSwipeUndoOptions {
  /**
   * Callback som återinsätter jobbet i föräldrarens jobs-array. När denna
   * är undefined är Ångra permanent avstängd (t.ex. i preview-läge).
   */
  onUndoSwipeAction?: (jobId: string) => void;
}

// 💾 Ångra-stacken överlever sidladdning. Utan detta tappade användaren
// möjligheten att ta tillbaka ett bortswipat jobb så fort hen råkade
// uppdatera sidan. sessionStorage = per flik, rensas när fliken stängs.
const UNDO_STORAGE_KEY = 'parium-swipe-undo-stack';
const MAX_UNDO_ENTRIES = 50;

function readPersistedStack(): string[] {
  try {
    const raw = sessionStorage.getItem(UNDO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

function persistStack(stack: string[]) {
  try {
    if (stack.length === 0) sessionStorage.removeItem(UNDO_STORAGE_KEY);
    else sessionStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(stack));
  } catch {
    /* private mode / full quota — ångra fungerar då bara i minnet */
  }
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
  const undoStackRef = useRef<string[]>(readPersistedStack());
  const pendingUndoJobIdRef = useRef<string | null>(null);
  const undoEntryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [canUndo, setCanUndo] = useState(() => undoStackRef.current.length > 0);
  const [undoEntryJobId, setUndoEntryJobId] = useState<string | null>(null);

  const pushSkipped = useCallback((jobId: string) => {
    // Cap:en gör att stacken inte växer obegränsat under en lång session.
    undoStackRef.current = [...undoStackRef.current, jobId].slice(-MAX_UNDO_ENTRIES);
    persistStack(undoStackRef.current);
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
    persistStack(undoStackRef.current);
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

  const consumePendingUndo = useCallback((): string | null => {
    const id = pendingUndoJobIdRef.current;
    pendingUndoJobIdRef.current = null;
    return id;
  }, []);

  return {
    canUndo: canUndo && !!onUndoSwipeAction,
    undoEntryJobId,
    consumePendingUndo,
    pushSkipped,
    handleUndo,
  };
}
