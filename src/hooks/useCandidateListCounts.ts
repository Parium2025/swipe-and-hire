import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { readCandidateCounts, writeCandidateCounts } from '@/lib/candidateCountsCache';

/**
 * Antal unika personer per kandidatlista — samma person räknas en gång
 * även om hen har sökt flera av dina jobb (räknas på applicant_id).
 *
 * Siffran sparas lokalt så den syns direkt vid kallstart och sedan
 * uppdateras mot databasen — samma mönster som sparade jobb/ansökningar.
 */
export const useCandidateListCounts = (enabled = true) => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['candidate-list-counts', user?.id],
    queryFn: async () => {
      if (!user) return {} as Record<string, number>;
      // Räknas i databasen. Att hämta hem raderna och räkna i klienten
      // kapades tyst vid 1000 rader och gav fel siffror på stora konton.
      const { data, error } = await supabase.rpc('count_my_candidates_per_list');
      if (error) throw error;

      const counts = Object.fromEntries(
        (data || []).map((row: { list_id: string; candidate_count: number }) => [
          row.list_id,
          Number(row.candidate_count) || 0,
        ]),
      ) as Record<string, number>;

      writeCandidateCounts('lists', user.id, counts);
      return counts;
    },

    enabled: enabled && !!user,
    staleTime: 30 * 1000,
    placeholderData: () => readCandidateCounts('lists', user?.id) ?? undefined,
  });

  return (query.data ?? {}) as Record<string, number>;
};
