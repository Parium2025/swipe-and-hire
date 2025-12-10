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
  salary_type?: string;
  salary_transparency?: string;
  employment_type?: string;
  work_schedule?: string;
  work_start_time?: string;
  work_end_time?: string;
  positions_count?: number;
  workplace_city?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  workplace_county?: string;
  workplace_municipality?: string;
  workplace_name?: string;
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

interface UseJobsDataOptions {
  scope?: 'personal' | 'organization';
}

export const useJobsData = (options: UseJobsDataOptions = { scope: 'personal' }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { scope } = options;

  // For organization scope, we need to fetch jobs from all users in the same organization
  const { data: jobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['jobs', scope, profile?.organization_id, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      if (scope === 'organization' && profile?.organization_id) {
        // Fetch all jobs from users in the same organization
        // First get all user_ids in the organization
        const { data: orgUsers, error: orgError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true);
        
        if (orgError) throw orgError;
        
        const userIds = orgUsers?.map(u => u.user_id) || [];
        
        // If no org users found, fall back to just the current user
        if (userIds.length === 0) {
          userIds.push(user.id);
        }
        
        const { data, error } = await supabase
          .from('job_postings')
          .select(`
            *,
            employer_profile:profiles!job_postings_employer_id_fkey (
              first_name,
              last_name
            )
          `)
          .in('employer_id', userIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } else {
        // Personal scope - only current user's jobs
        const { data, error } = await supabase
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

        if (error) throw error;
        return data || [];
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Memoize stats to prevent unnecessary recalculations
  // Only count active jobs for dashboard stats (exclude drafts)
  const activeJobsList = useMemo(() => jobs.filter(job => job.is_active), [jobs]);
  
  const stats = useMemo(() => ({
    totalJobs: activeJobsList.length,
    activeJobs: activeJobsList.length,
    totalViews: activeJobsList.reduce((sum, job) => sum + (job.views_count || 0), 0),
    totalApplications: activeJobsList.reduce((sum, job) => sum + (job.applications_count || 0), 0),
  }), [activeJobsList]);

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
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
