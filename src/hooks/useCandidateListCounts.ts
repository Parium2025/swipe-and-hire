import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Antal unika personer per kandidatlista — samma person räknas en gång
 * även om hen har sökt flera av dina jobb (räknas på applicant_id).
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

      return Object.fromEntries(
        (data || []).map((row: { list_id: string; candidate_count: number }) => [
          row.list_id,
          Number(row.candidate_count) || 0,
        ]),
      ) as Record<string, number>;
    },

    enabled: enabled && !!user,
    staleTime: 30 * 1000,
  });

  return (query.data ?? {}) as Record<string, number>;
};
