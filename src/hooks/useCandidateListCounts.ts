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
    enabled: enabled && !!user,
    staleTime: 30 * 1000,
  });

  return (query.data ?? {}) as Record<string, number>;
};
