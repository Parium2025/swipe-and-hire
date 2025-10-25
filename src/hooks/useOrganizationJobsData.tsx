import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { JobPosting } from './useJobsData';

export const useOrganizationJobsData = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['organization-jobs', profile?.organization_id],
    queryFn: async () => {
      if (!user || !profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('job_postings')
        .select(`
          *,
          employer_profile:employer_id (
            first_name,
            last_name
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!profile?.organization_id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const stats = {
    totalJobs: jobs.length,
    activeJobs: jobs.filter(job => job.is_active).length,
    totalViews: jobs.reduce((sum, job) => sum + (job.views_count || 0), 0),
    totalApplications: jobs.reduce((sum, job) => sum + (job.applications_count || 0), 0),
  };

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: ['organization-jobs', profile?.organization_id] });
  };

  return {
    jobs,
    stats,
    isLoading,
    error,
    refetch,
    invalidateJobs,
  };
};
