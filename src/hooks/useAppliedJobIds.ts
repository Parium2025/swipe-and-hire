import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
      const { data } = await supabase
        .from('job_applications')
        .select('job_id')
        .eq('applicant_id', user.id);
      return new Set((data || []).map(a => a.job_id));
    },
    enabled: !!user,
    staleTime: 60_000,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    structuralSharing: false,
  });
}
