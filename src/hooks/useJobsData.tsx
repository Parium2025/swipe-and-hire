import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

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
  employer_id: string;
  employer_profile?: {
    first_name: string;
    last_name: string;
  };
}

export interface Recruiter {
  id: string;
  first_name: string;
  last_name: string;
}

export const useJobsData = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['jobs', profile?.organization_id, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const query = supabase
        .from('job_postings')
        .select(`
          *,
          employer_profile:profiles!job_postings_employer_id_fkey (
            first_name,
            last_name
          )
        `)
        .eq('employer_id', user.id)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Memoize stats to prevent unnecessary recalculations
  const stats = useMemo(() => ({
    totalJobs: jobs.length,
    activeJobs: jobs.filter(job => job.is_active).length,
    totalViews: jobs.reduce((sum, job) => sum + (job.views_count || 0), 0),
    totalApplications: jobs.reduce((sum, job) => sum + (job.applications_count || 0), 0),
  }), [jobs]);

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs', profile?.organization_id] });
  };

  // Get unique recruiters from jobs
  const recruiters: Recruiter[] = useMemo(() => {
    const recruiterMap = new Map<string, Recruiter>();
    
    jobs.forEach(job => {
      if (job.employer_id && job.employer_profile?.first_name && job.employer_profile?.last_name) {
        if (!recruiterMap.has(job.employer_id)) {
          recruiterMap.set(job.employer_id, {
            id: job.employer_id,
            first_name: job.employer_profile.first_name,
            last_name: job.employer_profile.last_name,
          });
        }
      }
    });
    
    return Array.from(recruiterMap.values());
  }, [jobs]);

  return {
    jobs,
    stats,
    recruiters,
    isLoading,
    error,
    refetch,
    invalidateJobs,
  };
};
