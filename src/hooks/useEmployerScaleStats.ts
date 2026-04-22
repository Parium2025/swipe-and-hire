import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface EmployerJobsCounts {
  active: number;
  expired: number;
  draft: number;
  total: number;
}

export interface EmployerDashboardStats {
  active_jobs: number;
  total_views: number;
  total_applications: number;
}

/**
 * Server-side counts för aktiva/utgångna/utkast.
 * Använd när orgen kan ha 5–10k+ jobb och klient-side räkning blir för dyr.
 * Returnerar exakta totaler oavsett hur mycket som är laddat lokalt.
 */
export const useEmployerJobsCounts = (scope: 'personal' | 'organization' = 'personal') => {
  const { user, profile } = useAuth();
  return useQuery<EmployerJobsCounts>({
    queryKey: ['employer-jobs-counts', scope, profile?.organization_id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_employer_jobs_counts', { p_scope: scope });
      if (error) throw error;
      return (data as unknown as EmployerJobsCounts) ?? { active: 0, expired: 0, draft: 0, total: 0 };
    },
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Server-aggregerad statistik (visningar + ansökningar).
 * Skalar till miljoner ansökningar utan att lasta klienten.
 */
export const useEmployerDashboardStats = (scope: 'personal' | 'organization' = 'personal') => {
  const { user, profile } = useAuth();
  return useQuery<EmployerDashboardStats>({
    queryKey: ['employer-dashboard-stats', scope, profile?.organization_id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_employer_dashboard_stats', { p_scope: scope });
      if (error) throw error;
      return (data as unknown as EmployerDashboardStats) ?? { active_jobs: 0, total_views: 0, total_applications: 0 };
    },
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
};
