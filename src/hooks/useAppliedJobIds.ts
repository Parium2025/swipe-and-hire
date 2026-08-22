import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchAllPages } from '@/lib/fetchAllPages';


/**
 * 🚇 Delad query för "vilka jobb har jag sökt".
 *
 * Konsoliderar tre tidigare separata definitioner i SearchJobs, SavedJobs och
 * useJobSeekerBackgroundSync. Standardiserade settings:
 *  - staleTime: 60s (data ändras sällan, en ansökan triggar redan invalidate)
 *  - gcTime: Infinity (hålls i minnet hela sessionen)
 *  - refetchOnMount: false  → ingen ny request vid sidnavigering
 *  - refetchOnWindowFocus: false
 *
 * Resultat: vid byte mellan jobbsökarsidor görs ingen omfetch — vilket
 * eliminerar mount-laggen.
 */
export function useAppliedJobIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['applied-job-ids', user?.id],
    queryFn: async (): Promise<Set<string>> => {
      if (!user) return new Set();
      // Paginerat: en jobbsökare kan ha hur många ansökningar som helst.
      const rows = await fetchAllPages<{ job_id: string }>((from, to) =>
        supabase
          .from('job_applications')
          .select('job_id')
          .eq('applicant_id', user.id)
          .order('id', { ascending: true })
          .range(from, to),
      );
      return new Set(rows.map((a) => a.job_id));
    },

    enabled: !!user,
    staleTime: 60_000,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    structuralSharing: false,
  });
}
