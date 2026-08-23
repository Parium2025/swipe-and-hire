import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Sanna antal per steg (kolumn) i "Mina kandidater".
 *
 * Kolumnhuvudet visade tidigare hur många rader som råkade vara nedladdade,
 * vilket kröp uppåt medan sidorna trillade in. Den här hooken hämtar det
 * verkliga antalet i ETT anrop så badgen är korrekt från första sekunden —
 * oavsett om kolumnen innehåller 3 eller 3 000 kandidater.
 */
export function useMyCandidateStageCounts(listId: string | null, enabled = true) {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['my-candidates-stage-counts', user?.id, listId],
    enabled: !!user && enabled,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('count_my_candidates_per_stage', {
        p_list_id: listId,
      });
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data || []) as Array<{ stage: string; candidate_count: number }>) {
        counts[row.stage] = Number(row.candidate_count) || 0;
      }
      return counts;
    },
  });

  return data;
}
