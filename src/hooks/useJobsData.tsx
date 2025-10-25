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
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['jobs', profile?.organization_id, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Build query with employer profile join
      const query = supabase
        .from('job_postings')
        .select(`
          *,
          employer_profile:employer_id (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      // Prioritize organization_id, fallback to employer_id for legacy data
      if (profile?.organization_id) {
        query.eq('organization_id', profile.organization_id);
      } else {
        // Legacy fallback: show only own jobs if organization is missing
        query.eq('employer_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const stats = {
    totalJobs: jobs.length,
    activeJobs: jobs.filter(job => job.is_active).length,
    totalViews: jobs.reduce((sum, job) => sum + (job.views_count || 0), 0),
    totalApplications: jobs.reduce((sum, job) => sum + (job.applications_count || 0), 0),
  };

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs', profile?.organization_id] });
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
