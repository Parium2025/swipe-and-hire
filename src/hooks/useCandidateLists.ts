import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  getActiveCandidateListId,
  readCachedCandidateLists,
  setActiveCandidateListId,
  writeCachedCandidateLists,
} from '@/lib/activeCandidateList';

export interface CandidateList {
  id: string;
  owner_id: string;
  name: string;
  order_index: number;
  is_default: boolean;
  created_at: string;
}

export const MAX_CANDIDATE_LISTS = 10;

/**
 * Kandidatlistor för en ägare (jag själv eller en kollega).
 *
 * Varje lista har sina egna steg och sina egna kandidater — en kandidat kan
 * bara ligga i en lista i taget. Alla befintliga kandidater ligger i
 * standardlistan "Mina kandidater", som inte går att ta bort.
 */
export function useCandidateLists(ownerId: string | null, opts?: { ensureDefault?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwn = !!ownerId && ownerId === user?.id;
  const ensureDefault = opts?.ensureDefault && isOwn;

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['candidate-lists', ownerId],
    queryFn: async () => {
      if (!ownerId) return [];

      const fetchLists = async () => {
        const { data, error } = await supabase
          .from('candidate_lists')
          .select('id, owner_id, name, order_index, is_default, created_at')
          .eq('owner_id', ownerId)
          .order('order_index', { ascending: true })
          .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []) as CandidateList[];
      };

      let result = await fetchLists();

      // Nya användare har ingen lista än — skapa standardlistan direkt.
      if (result.length === 0 && ensureDefault) {
        const { error } = await supabase.rpc('ensure_default_candidate_list', { p_owner_id: ownerId });
        if (!error) result = await fetchLists();
      }

      if (isOwn) {
        writeCachedCandidateLists(ownerId, result.map(({ id, name, order_index, is_default }) => ({
          id, name, order_index, is_default,
        })));
      }
      return result;
    },
    enabled: !!ownerId,
    staleTime: 5 * 60 * 1000,
    initialData: () => {
      if (!isOwn || !ownerId) return undefined;
      const cached = readCachedCandidateLists(ownerId);
      if (!cached?.length) return undefined;
      return cached.map((l) => ({ ...l, owner_id: ownerId, created_at: '' })) as CandidateList[];
    },
    initialDataUpdatedAt: () => (isOwn && readCachedCandidateLists(ownerId) ? Date.now() - 1000 : undefined),
  });

  // 📡 Realtime: nya/ändrade listor (t.ex. från en annan flik eller enhet)
  useEffect(() => {
    if (!ownerId) return;
    const channel = supabase
      .channel(`candidate-lists-${ownerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidate_lists', filter: `owner_id=eq.${ownerId}` },
        () => queryClient.invalidateQueries({ queryKey: ['candidate-lists', ownerId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ownerId, queryClient]);

  const defaultList = useMemo(() => lists.find((l) => l.is_default) || lists[0] || null, [lists]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['candidate-lists', ownerId] });
  }, [queryClient, ownerId]);

  const createList = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Not authenticated');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Listan måste ha ett namn');
      if (lists.length >= MAX_CANDIDATE_LISTS) {
        throw new Error(`Du kan ha max ${MAX_CANDIDATE_LISTS} listor`);
      }
      if (lists.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error('Du har redan en lista med det namnet');
      }
      const { data, error } = await supabase
        .from('candidate_lists')
        .insert({
          owner_id: user.id,
          name: trimmed,
          order_index: lists.length,
          is_default: false,
        })
        .select('id, owner_id, name, order_index, is_default, created_at')
        .single();
      if (error) throw error;
      return data as CandidateList;
    },
    onSuccess: (list) => {
      invalidate();
      toast.success(`Listan "${list.name}" skapades`);
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte skapa listan'),
  });

  const renameList = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Listan måste ha ett namn');
      if (lists.some((l) => l.id !== id && l.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error('Du har redan en lista med det namnet');
      }
      const { error } = await supabase.from('candidate_lists').update({ name: trimmed }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Listan bytte namn');
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte byta namn'),
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const list = lists.find((l) => l.id === id);
      if (!list) throw new Error('Listan hittades inte');
      if (list.is_default) throw new Error('Standardlistan går inte att ta bort');
      const { error } = await supabase.from('candidate_lists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['my-candidates', ownerId] });
      queryClient.invalidateQueries({ queryKey: ['candidate-list-counts', ownerId] });
      toast.success('Listan togs bort');
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte ta bort listan'),
  });

  /**
   * Ny ordning på listorna. Tar emot id:n i önskad ordning och skriver
   * order_index 0..n. Cachen uppdateras direkt så menyn inte hoppar.
   */
  const reorderLists = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!ownerId) throw new Error('Not authenticated');
      const updates = orderedIds.map((id, index) =>
        supabase.from('candidate_lists').update({ order_index: index }).eq('id', id),
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      return orderedIds;
    },
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['candidate-lists', ownerId] });
      const previous = queryClient.getQueryData<CandidateList[]>(['candidate-lists', ownerId]);
      if (previous) {
        const byId = new Map(previous.map((l) => [l.id, l]));
        const next = orderedIds
          .map((id, index) => {
            const list = byId.get(id);
            return list ? { ...list, order_index: index } : null;
          })
          .filter(Boolean) as CandidateList[];
        if (next.length === previous.length) {
          queryClient.setQueryData(['candidate-lists', ownerId], next);
          if (isOwn) {
            writeCachedCandidateLists(ownerId!, next.map(({ id, name, order_index, is_default }) => ({
              id, name, order_index, is_default,
            })));
          }
        }
      }
      return { previous };
    },
    onError: (error: any, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['candidate-lists', ownerId], context.previous);
      }
      toast.error(error?.message || 'Kunde inte spara ordningen');
    },
    onSettled: () => invalidate(),
  });

  return { lists, defaultList, isLoading, createList, renameList, deleteList, reorderLists };
}

/**
 * Vald lista för den inloggade användaren. Läses synkront ur localStorage så
 * att första rendering hamnar rätt utan flimmer.
 */
export function useActiveCandidateList(lists: CandidateList[]) {
  const { user } = useAuth();
  const userId = user?.id;
  const [activeListId, setActiveListIdState] = useState<string | null>(() => getActiveCandidateListId(userId));

  // Håll valet giltigt: en borttagen lista faller tillbaka på standardlistan.
  useEffect(() => {
    if (!userId || lists.length === 0) return;
    const stillExists = activeListId && lists.some((l) => l.id === activeListId);
    if (stillExists) return;
    const fallback = lists.find((l) => l.is_default)?.id ?? lists[0].id;
    setActiveListIdState(fallback);
    setActiveCandidateListId(userId, fallback);
  }, [userId, lists, activeListId]);

  const setActiveListId = useCallback((listId: string | null) => {
    setActiveListIdState(listId);
    setActiveCandidateListId(userId, listId);
  }, [userId]);

  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId) ?? null,
    [lists, activeListId],
  );

  return { activeListId, activeList, setActiveListId };
}

/**
 * Alla synliga listor för ett gäng kollegor, i en enda query.
 * Används för att kunna hoppa direkt till "Annas lager-lista".
 */
export function useTeamCandidateLists(ownerIds: string[]) {
  const key = [...ownerIds].sort().join(',');

  const { data } = useQuery({
    queryKey: ['team-candidate-lists', key],
    queryFn: async () => {
      if (ownerIds.length === 0) return {} as Record<string, CandidateList[]>;
      const { data, error } = await supabase
        .from('candidate_lists')
        .select('id, owner_id, name, order_index, is_default, created_at')
        .in('owner_id', ownerIds)
        .order('order_index', { ascending: true });
      if (error) throw error;

      const grouped: Record<string, CandidateList[]> = {};
      for (const list of (data || []) as CandidateList[]) {
        (grouped[list.owner_id] ||= []).push(list);
      }
      return grouped;
    },
    enabled: ownerIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return data ?? {};
}
