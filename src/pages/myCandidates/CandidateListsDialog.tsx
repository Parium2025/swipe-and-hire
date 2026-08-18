import { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Check, ListPlus, Pencil, Trash2, X } from 'lucide-react';
import type { CandidateList } from '@/hooks/useCandidateLists';
import { MAX_CANDIDATE_LISTS } from '@/hooks/useCandidateLists';

interface CandidateListsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: CandidateList[];
  countByList: Record<string, number>;
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

export const CandidateListsDialog = ({
  open,
  onOpenChange,
  lists,
  countByList,
  onCreate,
  onRename,
  onDelete,
}: CandidateListsDialogProps) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CandidateList | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewName('');
      setEditingId(null);
      setEditingName('');
      setPendingDelete(null);
    }
  }, [open]);

  const atLimit = lists.length >= MAX_CANDIDATE_LISTS;

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card-parium border-white/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Hantera listor</DialogTitle>
            <DialogDescription className="text-white/70">
              Dela upp kandidaterna i egna listor, till exempel Lager eller Chefsroller.
              Varje lista har sina egna steg.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
            {lists.map((list) => (
              <div
                key={list.id}
                className="flex items-center gap-2 rounded-lg bg-white/5 ring-1 ring-inset ring-white/10 px-3 py-2 min-w-0"
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
                      className="h-9 text-base bg-white/5 border-white/20 text-white"
                    />
                    <button
                      onClick={() => handleRename(list.id)}
                      aria-label="Spara namn"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-white hover:bg-white/10"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      aria-label="Avbryt"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-white hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{list.name}</p>
                      <p className="text-xs text-white/60">
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
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-white hover:bg-white/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      disabled={list.is_default}
                      onClick={() => setPendingDelete(list)}
                      aria-label={`Ta bort ${list.name}`}
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md transition-colors ${
                        list.is_default
                          ? 'text-white/25 cursor-not-allowed'
                          : 'text-white border border-destructive/40 bg-destructive/20 hover:bg-destructive/30'
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder={atLimit ? `Max ${MAX_CANDIDATE_LISTS} listor` : 'Namn på ny lista'}
              maxLength={40}
              disabled={atLimit}
              className="h-10 text-base bg-white/5 border-white/20 text-white placeholder:text-white/60"
            />
            <Button
              onClick={handleCreate}
              disabled={atLimit || !newName.trim() || busy}
              className="h-10 flex-shrink-0"
            >
              <ListPlus className="h-4 w-4 mr-1.5" />
              Skapa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent className="bg-card-parium border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Ta bort "{pendingDelete?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              {(countByList[pendingDelete?.id ?? ''] ?? 0) > 0
                ? `Listan innehåller ${countByList[pendingDelete!.id]} kandidater. De tas bort från din pipeline — ansökningarna finns kvar under Kandidater.`
                : 'Listan och dess steg tas bort. Det går inte att ångra.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-white">Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const target = pendingDelete;
                setPendingDelete(null);
                if (target) await onDelete(target.id);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Ta bort listan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
