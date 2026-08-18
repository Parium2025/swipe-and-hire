import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { TruncatedText } from '@/components/TruncatedText';
import { useCandidateListCounts } from '@/hooks/useCandidateListCounts';
import { AlertTriangle, Check, GripVertical, ListPlus, Pencil, Trash2, X } from 'lucide-react';
import type { CandidateList } from '@/hooks/useCandidateLists';
import { MAX_CANDIDATE_LISTS } from '@/hooks/useCandidateLists';

interface CandidateListsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: CandidateList[];
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onReorder?: (orderedIds: string[]) => Promise<unknown> | void;
}

export const CandidateListsDialog = ({
  open,
  onOpenChange,
  lists,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: CandidateListsDialogProps) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CandidateList | null>(null);
  const [busy, setBusy] = useState(false);

  // Lokal ordning under pågående drag — synkas från servern när vi inte drar.
  const [order, setOrder] = useState<CandidateList[]>(lists);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const orderRef = useRef<CandidateList[]>(lists);
  const startOrderRef = useRef<string[]>([]);

  const countByList = useCandidateListCounts(open);

  useEffect(() => {
    if (draggingId) return;
    setOrder(lists);
    orderRef.current = lists;
  }, [lists, draggingId]);

  useEffect(() => {
    if (!open) {
      setNewName('');
      setEditingId(null);
      setEditingName('');
      setPendingDelete(null);
      setDraggingId(null);
    }
  }, [open]);

  const atLimit = lists.length >= MAX_CANDIDATE_LISTS;
  const canReorder = !!onReorder && lists.length > 1;

  const handleCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate(newName);
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim() || busy) return;
    setBusy(true);
    try {
      await onRename(id, editingName);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  const moveTo = useCallback((id: string, targetIndex: number) => {
    const current = orderRef.current;
    const from = current.findIndex((l) => l.id === id);
    if (from === -1 || targetIndex === from) return;
    const clamped = Math.max(0, Math.min(current.length - 1, targetIndex));
    if (clamped === from) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(clamped, 0, moved);
    orderRef.current = next;
    setOrder(next);
  }, []);

  const handleDragPointerDown = (id: string) => (e: React.PointerEvent) => {
    if (!canReorder || editingId) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startOrderRef.current = orderRef.current.map((l) => l.id);
    setDraggingId(id);
  };

  const handleDragPointerMove = (id: string) => (e: React.PointerEvent) => {
    if (draggingId !== id) return;
    const y = e.clientY;
    const entries = orderRef.current
      .map((l) => {
        const el = rowRefs.current.get(l.id);
        return el ? { id: l.id, rect: el.getBoundingClientRect() } : null;
      })
      .filter(Boolean) as { id: string; rect: DOMRect }[];

    for (let i = 0; i < entries.length; i++) {
      const { id: otherId, rect } = entries[i];
      if (otherId === id) continue;
      const midpoint = rect.top + rect.height / 2;
      const currentIndex = orderRef.current.findIndex((l) => l.id === id);
      if (i < currentIndex && y < midpoint) {
        moveTo(id, i);
        return;
      }
      if (i > currentIndex && y > midpoint) {
        moveTo(id, i);
        return;
      }
    }
  };

  const finishDrag = (e: React.PointerEvent) => {
    if (!draggingId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer redan släppt */
    }
    setDraggingId(null);
    const nextIds = orderRef.current.map((l) => l.id);
    const changed = nextIds.some((id, i) => id !== startOrderRef.current[i]);
    if (changed) onReorder?.(nextIds);
  };

  const pendingCount = pendingDelete ? countByList[pendingDelete.id] ?? 0 : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card-parium border-white/20 rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Hantera listor</DialogTitle>
            <DialogDescription className="text-white">
              Dela upp kandidaterna i egna listor, till exempel Lager eller Chefsroller.
              Varje lista har sina egna steg.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[45vh] overflow-y-auto overflow-x-hidden px-0.5 py-0.5">
            {order.map((list) => (
              <div
                key={list.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(list.id, el);
                  else rowRefs.current.delete(list.id);
                }}
                className={`relative flex w-full items-center gap-2 overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/20 pr-1.5 py-1.5 min-w-0 transition-colors duration-200 ${
                  canReorder && editingId !== list.id ? 'pl-1' : 'pl-4'
                } ${draggingId === list.id ? 'bg-white/15 ring-white/40' : ''}`}
              >
                {editingId === list.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(list.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      maxLength={40}
                      className="h-9 rounded-full text-base bg-white/5 border-white/20 text-white"
                    />
                    <button
                      onClick={() => handleRename(list.id)}
                      aria-label="Spara namn"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white bg-white/10 transition-colors md:hover:bg-white/20"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      aria-label="Avbryt"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white bg-white/10 transition-colors md:hover:bg-white/20"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    {canReorder && (
                      <button
                        type="button"
                        aria-label={`Flytta ${list.name}`}
                        onPointerDown={handleDragPointerDown(list.id)}
                        onPointerMove={handleDragPointerMove(list.id)}
                        onPointerUp={finishDrag}
                        onPointerCancel={finishDrag}
                        onKeyDown={(e) => {
                          const index = order.findIndex((l) => l.id === list.id);
                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            const target = index + (e.key === 'ArrowUp' ? -1 : 1);
                            if (target < 0 || target >= order.length) return;
                            const next = [...order];
                            const [moved] = next.splice(index, 1);
                            next.splice(target, 0, moved);
                            orderRef.current = next;
                            setOrder(next);
                            onReorder?.(next.map((l) => l.id));
                          }
                        }}
                        className="flex h-9 w-8 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-white transition-colors active:cursor-grabbing md:hover:bg-white/10"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                    )}
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className="truncate text-sm font-medium text-white">{list.name}</p>
                      <p className="text-xs text-white">
                        {countByList[list.id] ?? 0} kandidater
                        {list.is_default ? ' · standardlista' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(list.id);
                        setEditingName(list.name);
                      }}
                      aria-label={`Byt namn på ${list.name}`}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white bg-white/10 transition-colors md:hover:bg-white/20"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      disabled={list.is_default}
                      onClick={() => setPendingDelete(list)}
                      aria-label={`Ta bort ${list.name}`}
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                        list.is_default
                          ? 'border-white/5 text-white/30 bg-white/5 cursor-not-allowed'
                          : 'border-destructive/40 bg-destructive/20 text-white md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white'
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder={atLimit ? `Max ${MAX_CANDIDATE_LISTS} listor` : 'Namn på ny lista'}
              maxLength={40}
              disabled={atLimit}
              className="h-11 rounded-full px-5 text-base bg-white/5 border-white/20 text-white placeholder:text-white/70"
            />
            <button
              onClick={handleCreate}
              disabled={atLimit || !newName.trim() || busy}
              className={`flex h-11 flex-shrink-0 items-center gap-1.5 rounded-full px-5 text-sm font-medium text-white ring-1 ring-inset transition-all active:scale-[0.97] touch-manipulation ${
                atLimit || !newName.trim() || busy
                  ? 'bg-white/5 ring-white/10 opacity-40 cursor-default'
                  : 'bg-white/10 ring-white/30 md:hover:bg-white/20'
              }`}
            >
              <ListPlus className="h-4 w-4" />
              Skapa
            </button>
          </div>
          <p className="text-xs text-white">
            {lists.length} av {MAX_CANDIDATE_LISTS} listor.
            {canReorder ? ' Dra i handtaget för att ändra ordningen.' : ''} En kandidat kan bara
            ligga i en lista åt gången — även om personen har sökt flera av dina jobb.
          </p>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0 max-h-[90dvh] flex flex-col">
          <AlertDialogHeader className="space-y-4 text-center flex-shrink-0">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort lista
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>
          <div className="overflow-y-auto flex-1 my-4">
            <AlertDialogDescription className="text-white text-sm leading-relaxed text-center">
              {pendingDelete && (
                <>
                  Är du säker på att du vill ta bort{' '}
                  <TruncatedText
                    text={`"${pendingDelete.name}"`}
                    className="font-semibold text-white inline-block max-w-[220px] truncate align-bottom"
                  />
                  ?{' '}
                  {pendingCount > 0
                    ? `${pendingCount} ${pendingCount === 1 ? 'kandidat' : 'kandidater'} tas bort från din pipeline tillsammans med listans egna steg — ansökningarna finns kvar under Kandidater. Vill du behålla dem: stäng den här rutan, markera kandidaterna och flytta dem till en annan lista först. `
                    : 'Listans egna steg tas bort. '}
                  Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-center flex-shrink-0">
            <AlertDialogCancel
              onClick={() => setPendingDelete(null)}
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const target = pendingDelete;
                setPendingDelete(null);
                if (target) await onDelete(target.id);
              }}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
