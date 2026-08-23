import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { enqueueCandidateOperation } from '@/hooks/useCandidateOperationQueue';
import type { MyCandidateData, CandidateStage } from '@/hooks/useMyCandidatesData';

interface UseBulkCandidateOpsParams {
  debouncedSearchQuery: string;
  listId: string | null;
  stageConfig: Record<string, { label: string; color: string; iconName: string }>;
  isViewingColleague: boolean;
  moveCandidateInColleagueList: (id: string, stage: string) => Promise<void>;
  removeCandidateFromColleagueList: (id: string) => Promise<void>;
  exitSelectionMode: () => void;
  selectedCandidateIds: Set<string>;
  displayedCandidates: MyCandidateData[];
}

/**
 * Bulk move/delete with the same retry-queue resilience as single operations.
 */
export function useBulkCandidateOps({
  debouncedSearchQuery,
  listId,
  stageConfig,
  isViewingColleague,
  moveCandidateInColleagueList,
  removeCandidateFromColleagueList,
  exitSelectionMode,
  selectedCandidateIds,
  displayedCandidates,
}: UseBulkCandidateOpsParams) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['my-candidates', user?.id, debouncedSearchQuery, listId] as const;

  const updateCandidatesCache = useCallback(
    (updater: (items: MyCandidateData[]) => MyCandidateData[]) => {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: updater(page.items),
          })),
        };
      });
    },
    [queryClient, queryKey[0], queryKey[1], queryKey[2], queryKey[3]],
  );

  const bulkMoveToStage = useCallback(
    async (targetStage: CandidateStage) => {
      const ids = Array.from(selectedCandidateIds);
      const count = ids.length;
      const cfg = stageConfig[targetStage];
      const label = cfg?.label || targetStage;
      const color = cfg?.color || '#22c55e';

      if (isViewingColleague) {
        for (const id of ids) await moveCandidateInColleagueList(id, targetStage);
        exitSelectionMode();
        // Håll stegräknare och kollegors vy i synk – enskilda flyttar gör detta,
        // bulkflytten missade det tidigare.
        queryClient.invalidateQueries({ queryKey: ['candidate-list-counts', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['team-candidate-info'] });
        toast.success(`${count} kandidater flyttade till "${label}"`, {
          icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />,
        });
        return;
      }

      // Optimistic
      updateCandidatesCache(items =>
        items.map(c => selectedCandidateIds.has(c.id) ? { ...c, stage: targetStage } : c),
      );
      exitSelectionMode();

      try {
        const { data, error } = await supabase
          .from('my_candidates')
          .update({ stage: targetStage, updated_at: new Date().toISOString() })
          .in('id', ids)
          .select('id');

        if (error) throw error;
        if ((data?.length ?? 0) < ids.length) {
          throw new Error('Vissa kandidater kunde inte flyttas');
        }
        queryClient.invalidateQueries({ queryKey: ['candidate-list-counts', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['team-candidate-info'] });
        toast.success(`${count} kandidater flyttade till "${label}"`, {
          icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />,
        });
      } catch {
        // Enqueue each failed move for retry
        if (user) {
          ids.forEach(id => {
            const c = displayedCandidates.find(x => x.id === id);
            enqueueCandidateOperation({
              type: 'stage_move',
              candidateId: id,
              recruiterId: user.id,
              payload: { stage: targetStage },
              candidateName: c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : undefined,
            });
          });
          toast.info('Flytten köad – synkas automatiskt', { duration: 3000 });
        } else {
          queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
          toast.error('Kunde inte flytta kandidaterna');
        }
      }
    },
    [selectedCandidateIds, stageConfig, isViewingColleague, moveCandidateInColleagueList, exitSelectionMode, updateCandidatesCache, user, displayedCandidates, queryClient],
  );

  const bulkDelete = useCallback(
    async () => {
      const ids = Array.from(selectedCandidateIds);

      if (isViewingColleague) {
        for (const id of ids) await removeCandidateFromColleagueList(id);
        exitSelectionMode();
        toast.success(`${ids.length} kandidater borttagna`);
        return;
      }

      // Optimistic
      updateCandidatesCache(items => items.filter(c => !selectedCandidateIds.has(c.id)));
      exitSelectionMode();

      try {
        const { data, error } = await supabase
          .from('my_candidates')
          .delete()
          .in('id', ids)
          .select('id');

        if (error) throw error;
        if ((data?.length ?? 0) < ids.length) {
          throw new Error('Vissa kandidater kunde inte tas bort');
        }
        queryClient.invalidateQueries({ queryKey: ['candidate-list-counts', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['team-candidate-info'] });
        toast.success(`${ids.length} kandidater borttagna från din lista`);
      } catch {
        if (user) {
          ids.forEach(id => {
            const c = displayedCandidates.find(x => x.id === id);
            enqueueCandidateOperation({
              type: 'remove',
              candidateId: id,
              recruiterId: user.id,
              payload: {},
              candidateName: c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : undefined,
            });
          });
          toast.info('Borttagning köad – synkas automatiskt', { duration: 3000 });
        } else {
          queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
          toast.error('Kunde inte ta bort kandidaterna');
        }
      }
    },
    [selectedCandidateIds, isViewingColleague, removeCandidateFromColleagueList, exitSelectionMode, updateCandidatesCache, user, displayedCandidates, queryClient],
  );

  /**
   * Flytta valda kandidater till en annan lista.
   *
   * En kandidat kan bara ligga i en lista i taget, så raden flyttas — den
   * kopieras inte. Eftersom stegen är unika per lista landar kandidaten i
   * mållistans första steg.
   */
  const bulkMoveToList = useCallback(
    async (targetListId: string, targetListName: string) => {
      if (!user || isViewingColleague) return;
      const ids = Array.from(selectedCandidateIds);
      if (ids.length === 0) return;

      // Mållistans första steg (stegen skiljer sig mellan listor)
      const { data: targetStages } = await supabase
        .from('user_stage_settings')
        .select('stage_key, order_index')
        .eq('user_id', user.id)
        .eq('list_id', targetListId)
        .gt('order_index', -1)
        .order('order_index', { ascending: true })
        .limit(1);

      const targetStage = targetStages?.[0]?.stage_key || 'to_contact';

      // Optimistiskt: kandidaterna försvinner ur den lista vi tittar på
      updateCandidatesCache(items => items.filter(c => !selectedCandidateIds.has(c.id)));
      exitSelectionMode();

      const { data, error } = await supabase
        .from('my_candidates')
        .update({ list_id: targetListId, stage: targetStage, updated_at: new Date().toISOString() })
        .in('id', ids)
        .select('id');

      if (error || (data?.length ?? 0) < ids.length) {
        queryClient.invalidateQueries({ queryKey: ['my-candidates', user.id] });
        toast.error('Kunde inte flytta alla kandidater');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['my-candidates', user.id] });
      queryClient.invalidateQueries({ queryKey: ['candidate-list-counts', user.id] });
      toast.success(`${ids.length} kandidat${ids.length !== 1 ? 'er' : ''} flyttade till "${targetListName}"`);
    },
    [user, isViewingColleague, selectedCandidateIds, updateCandidatesCache, exitSelectionMode, queryClient],
  );

  return { bulkMoveToStage, bulkDelete, bulkMoveToList, updateCandidatesCache };
}
