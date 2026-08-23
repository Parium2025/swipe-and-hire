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
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { Input } from '@/components/ui/input';
import { TruncatedText } from '@/components/TruncatedText';
import { useCandidateListCounts } from '@/hooks/useCandidateListCounts';
import { AlertTriangle, Check, GripVertical, ListPlus, Pencil, Trash2, X } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTouchCapable } from '@/hooks/useInputCapability';
import type { CandidateList } from '@/hooks/useCandidateLists';
import { MAX_CANDIDATE_LISTS } from '@/hooks/useCandidateLists';

interface SortableListRowProps {
  list: CandidateList;
  canReorder: boolean;
  isEditing: boolean;
  count: number;
  editingName: string;
  onEditingNameChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onRequestDelete: () => void;
}

const SortableListRow = ({
  list,
  canReorder,
  isEditing,
  count,
  editingName,
  onEditingNameChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
}: SortableListRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    disabled: !canReorder || isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
    willChange: 'transform',
    zIndex: isDragging ? 20 : 'auto' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex w-full select-none items-center gap-2 overflow-hidden rounded-full bg-white/5 py-1.5 pr-1.5 ring-1 ring-inset ring-white/20 min-w-0 transition-colors duration-150 ${
        canReorder && !isEditing ? 'pl-1' : 'pl-4'
      } ${isDragging ? 'bg-white/10 ring-white/30' : ''}`}
    >
      {isEditing ? (
        <>
          <Input
            autoFocus
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            maxLength={40}
            className="h-9 rounded-full text-base bg-white/5 border-white/20 text-white focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <button
            onClick={onSaveEdit}
            aria-label="Spara namn"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white bg-white/10 transition-colors md:hover:bg-white/20 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onCancelEdit}
            aria-label="Avbryt"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white bg-white/10 transition-colors md:hover:bg-white/20 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          {canReorder && (
            <div
              data-dnd-draggable="true"
              aria-label={`Flytta ${list.name}`}
              {...attributes}
              {...listeners}
              className="flex h-9 w-9 flex-shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-full text-white transition-colors active:cursor-grabbing md:hover:bg-white/10 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1 py-0.5">
            <p className="truncate text-sm font-medium text-white">{list.name}</p>
            <p className="text-xs text-white">
              {count} kandidater
              {list.is_default ? ' · standardlista' : ''}
            </p>
          </div>
          <button
            onClick={onStartEdit}
            aria-label={`Byt namn på ${list.name}`}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white bg-white/10 transition-colors md:hover:bg-white/20 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            disabled={list.is_default}
            onPointerDown={(event) => event.preventDefault()}
            onClick={onRequestDelete}
            aria-label={`Ta bort ${list.name}`}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-colors focus:outline-none focus:ring-0 focus-visible:ring-0 ${
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
  );
};


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
  const orderRef = useRef<CandidateList[]>(lists);

  const isTouchCapable = useTouchCapable();
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 120, tolerance: 8 },
  });
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 6 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(
    ...(isTouchCapable ? [touchSensor, keyboardSensor] : [pointerSensor, keyboardSensor]),
  );

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

  const handleRename = async (id: string, currentName?: string) => {
    const next = editingName.trim();
    if (!next || busy) return;
    // Inget faktiskt namnbyte -> stäng bara redigeringen, ingen notis
    if (currentName !== undefined && next === currentName.trim()) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      await onRename(id, next);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggingId(null);
      if (!over || active.id === over.id) return;
      const current = orderRef.current;
      const from = current.findIndex((l) => l.id === active.id);
      const to = current.findIndex((l) => l.id === over.id);
      if (from === -1 || to === -1) return;
      const next = arrayMove(current, from, to);
      orderRef.current = next;
      setOrder(next);
      onReorder?.(next.map((l) => l.id));
    },
    [onReorder],
  );


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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              autoScroll
              measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
              onDragStart={(event: DragStartEvent) => setDraggingId(String(event.active.id))}
              onDragCancel={() => setDraggingId(null)}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={order.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                {order.map((list) => (
                  <SortableListRow
                    key={list.id}
                    list={list}
                    canReorder={canReorder}
                    isEditing={editingId === list.id}
                    count={countByList[list.id] ?? 0}
                    editingName={editingName}
                    onEditingNameChange={setEditingName}
                    onStartEdit={() => {
                      setEditingId(list.id);
                      setEditingName(list.name);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={() => handleRename(list.id, list.name)}
                    onRequestDelete={() => setPendingDelete(list)}
                  />
                ))}
                </div>
              </SortableContext>

            </DndContext>

          </div>

          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder={atLimit ? `Max ${MAX_CANDIDATE_LISTS} listor` : 'Namn på ny lista'}
              maxLength={40}
              disabled={atLimit}
              className="h-11 rounded-full px-5 text-base bg-white/5 border-white/20 text-white placeholder:text-white/70 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              onClick={handleCreate}
              disabled={atLimit || !newName.trim() || busy}
              className={`flex h-11 flex-shrink-0 items-center gap-1.5 rounded-full px-5 text-sm font-medium text-white ring-1 ring-inset transition-all active:scale-[0.97] touch-manipulation focus:outline-none focus:ring-0 focus-visible:ring-0 ${
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
        <AlertDialogContentNoFocus className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0 max-h-[90dvh] flex flex-col outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent]">
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
                    ? `${pendingCount} ${pendingCount === 1 ? 'kandidat' : 'kandidater'} flyttas automatiskt till standardlistan "Mina kandidater". Listans egna steg tas bort. `
                    : 'Listans egna steg tas bort. '}

                  Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-center flex-shrink-0">
            <AlertDialogCancel
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => setPendingDelete(null)}
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50 !outline-none !ring-0 !ring-offset-0 focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 active:!outline-none [-webkit-tap-highlight-color:transparent]"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onPointerDown={(event) => event.preventDefault()}
              onClick={async () => {
                const target = pendingDelete;
                setPendingDelete(null);
                if (target) await onDelete(target.id);
              }}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full !outline-none !ring-0 !ring-offset-0 focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 active:!outline-none [-webkit-tap-highlight-color:transparent]"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
};
