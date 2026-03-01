import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { enqueueCandidateOperation } from '@/hooks/useCandidateOperationQueue';
import type { MyCandidateData, CandidateStage } from '@/hooks/useMyCandidatesData';

interface UseBulkCandidateOpsParams {
  debouncedSearchQuery: string;
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

  const queryKey = ['my-candidates', user?.id, debouncedSearchQuery] as const;

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
    [queryClient, queryKey[0], queryKey[1], queryKey[2]],
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
        const { error } = await supabase
          .from('my_candidates')
          .update({ stage: targetStage, updated_at: new Date().toISOString() })
          .in('id', ids);

        if (error) throw error;
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
        const { error } = await supabase
          .from('my_candidates')
          .delete()
          .in('id', ids);

        if (error) throw error;
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

  return { bulkMoveToStage, bulkDelete, updateCandidatesCache };
}
