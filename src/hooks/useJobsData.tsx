import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface JobPosting {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  employment_type?: string;
  work_schedule?: string;
  contact_email?: string;
  application_instructions?: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  created_at: string;
  updated_at: string;
  employer_profile?: {
    first_name: string;
    last_name: string;
  };
}

export const useJobsData = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['jobs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('job_postings')
        .select(`
          *,
          employer_profile:employer_id (
            first_name,
            last_name
          )
        `)
        .eq('employer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
  });

  const stats = {
    totalJobs: jobs.length,
    activeJobs: jobs.filter(job => job.is_active).length,
    totalViews: jobs.reduce((sum, job) => sum + (job.views_count || 0), 0),
    totalApplications: jobs.reduce((sum, job) => sum + (job.applications_count || 0), 0),
  };

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs', user?.id] });
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
