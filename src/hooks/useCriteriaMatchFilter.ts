import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CriteriaMatchFilter {
  /** Nycklar (`${job_id}-${applicant_id}`) för kandidater som ska visas. */
  keep: Set<string>;
  /** Nycklar vars AI-granskning ännu inte är klar. */
  pending: Set<string>;
}

/**
 * Serverbaserad filtrering av kandidater mot valda urvalskriterier.
 *
 * Hela urvalet görs i databasen (funktionen `filter_candidates_by_criteria`),
 * så volymen kandidater i annonsen spelar ingen roll — bara de som matchar
 * (plus de som väntar på AI-granskning) skickas tillbaka till klienten.
 */
export function useCriteriaMatchFilter(
  jobIds: string[],
  criterionIds: string[],
  enabled: boolean,
) {
  const { user } = useAuth();
  const sortedJobIds = [...new Set(jobIds)].filter(Boolean).sort();
  const sortedCriteria = [...new Set(criterionIds)].filter(Boolean).sort();

  return useQuery<CriteriaMatchFilter>({
    queryKey: ['criteria-match-filter', sortedJobIds.join(','), sortedCriteria.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('filter_candidates_by_criteria', {
        _job_ids: sortedJobIds,
        _criterion_ids: sortedCriteria,
      });
      if (error) throw error;

      const keep = new Set<string>();
      const pending = new Set<string>();
      for (const row of (data || []) as {
        job_id: string;
        applicant_id: string;
        match_state: string;
      }[]) {
        const key = `${row.job_id}-${row.applicant_id}`;
        keep.add(key);
        if (row.match_state === 'pending') pending.add(key);
      }
      return { keep, pending };
    },
    enabled: !!user && enabled && sortedJobIds.length > 0 && sortedCriteria.length > 0,
    staleTime: 30 * 1000,
  });
}
