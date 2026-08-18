import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Check, ListPlus, Pencil, Trash2, X } from 'lucide-react';
import type { CandidateList } from '@/hooks/useCandidateLists';
import { MAX_CANDIDATE_LISTS } from '@/hooks/useCandidateLists';

interface CandidateListsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: CandidateList[];
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

export const CandidateListsDialog = ({
  open,
  onOpenChange,
  lists,
  onCreate,
  onRename,
  onDelete,
}: CandidateListsDialogProps) => {
  const { user } = useAuth();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CandidateList | null>(null);
  const [busy, setBusy] = useState(false);

  // Antal unika personer per lista — samma person räknas en gång även om
  // hen sökt flera jobb.
  const { data: countByList = {} } = useQuery({
    queryKey: ['candidate-list-counts', user?.id],
    queryFn: async () => {
      if (!user) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from('my_candidates')
        .select('list_id, applicant_id')
        .eq('recruiter_id', user.id);
      if (error) throw error;

      const seen = new Map<string, Set<string>>();
      for (const row of data || []) {
        if (!row.list_id) continue;
        const set = seen.get(row.list_id) ?? new Set<string>();
        set.add(row.applicant_id);
        seen.set(row.list_id, set);
      }
      return Object.fromEntries([...seen].map(([id, set]) => [id, set.size]));
    },
    enabled: open && !!user,
    staleTime: 30 * 1000,
  });

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

          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
            {lists.map((list) => (
              <div
                key={list.id}
                className="flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-inset ring-white/20 pl-4 pr-1.5 py-1.5 min-w-0"
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
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                        list.is_default
                          ? 'text-white/30 bg-white/5 cursor-not-allowed'
                          : 'text-white border border-destructive/40 bg-destructive/20 md:hover:bg-destructive/30'
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
            {lists.length} av {MAX_CANDIDATE_LISTS} listor. En kandidat kan bara ligga i en lista
            åt gången — även om personen har sökt flera av dina jobb.
          </p>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent className="bg-card-parium border-white/20 rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Ta bort "{pendingDelete?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white">
              {pendingCount > 0
                ? `Listan innehåller ${pendingCount} kandidater. De tas bort från din pipeline — ansökningarna finns kvar under Kandidater.`
                : 'Listan och dess steg tas bort. Det går inte att ångra.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full text-white">Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const target = pendingDelete;
                setPendingDelete(null);
                if (target) await onDelete(target.id);
              }}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              Ta bort listan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
