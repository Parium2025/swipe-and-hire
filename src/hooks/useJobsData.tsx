import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useEffect } from 'react';
import { isJobExpiredCheck } from '@/lib/date';

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
  expires_at?: string;
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
  enableRealtime?: boolean;
}

// 🔥 localStorage cache for employer jobs - instant-load
const EMPLOYER_JOBS_CACHE_KEY = 'parium_employer_jobs_';

interface CachedJobs {
  jobs: JobPosting[];
  scope: string;
  orgId: string | null;
  timestamp: number;
}

function readJobsCache(userId: string, scope: string, orgId: string | null): JobPosting[] | null {
  try {
    const key = EMPLOYER_JOBS_CACHE_KEY + userId;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached: CachedJobs = JSON.parse(raw);
    // Only use if same scope and org
    if (cached.scope !== scope || cached.orgId !== orgId) return null;
    return cached.jobs;
  } catch {
    return null;
  }
}

function writeJobsCache(userId: string, scope: string, orgId: string | null, jobs: JobPosting[]): void {
  try {
    const key = EMPLOYER_JOBS_CACHE_KEY + userId;
    const cached: CachedJobs = {
      jobs: jobs.slice(0, 100), // Max 100 jobs to save space
      scope,
      orgId,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // Storage full
  }
}

export const useJobsData = (options: UseJobsDataOptions = { scope: 'personal', enableRealtime: true }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { scope, enableRealtime = true } = options;

  // Check for cached data BEFORE query runs
  const hasCachedData = user ? readJobsCache(user.id, scope || 'personal', profile?.organization_id || null) !== null : false;

  // For organization scope, we need to fetch jobs from all users in the same organization
  const { data: jobs = [], isLoading: queryLoading, error, refetch } = useQuery({
    queryKey: ['jobs', scope, profile?.organization_id, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      let result: JobPosting[] = [];
      
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
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(500);

        if (error) throw error;
        result = data || [];
      } else {
        // Personal scope - only current user's jobs (exclude soft-deleted)
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
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(500);

        if (error) throw error;
        result = data || [];
      }

      // 🔥 Cache for instant-load on next visit
      writeJobsCache(user.id, scope || 'personal', profile?.organization_id || null, result);

      return result;
    },
    enabled: !!user,
    staleTime: Infinity, // Never refetch — realtime handles all updates
    gcTime: Infinity, // Keep in cache permanently during session
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // 🔥 Instant-load from localStorage cache
    initialData: () => {
      if (!user) return undefined;
      const cached = readJobsCache(user.id, scope || 'personal', profile?.organization_id || null);
      return cached ?? undefined;
    },
    initialDataUpdatedAt: () => {
      if (!user) return undefined;
      const cached = readJobsCache(user.id, scope || 'personal', profile?.organization_id || null);
      return cached ? Date.now() - 60000 : undefined; // Trigger background refetch
    },
  });

  // Only show loading if we don't have cached data
  const isLoading = queryLoading && !hasCachedData;

  // Real-time subscription for job_postings changes
  // 🔥 SCALED: Filter by employer_id to avoid broadcasting all changes to all clients
  useEffect(() => {
    if (!enableRealtime || !user) return;

    // For personal scope, filter realtime to only this employer's jobs
    // For org scope, we still need broader listening but use a unique channel name
    const channelSuffix = `${user.id}-${scope}`;
    
    // Only filter for personal scope — org scope needs all org members' jobs
    const jobFilter = scope !== 'organization' ? `employer_id=eq.${user.id}` : undefined;

    const channel = supabase
      .channel(`job-postings-rt-${channelSuffix}`)
      .on(
        'postgres_changes',
        jobFilter
          ? { event: '*' as const, schema: 'public' as const, table: 'job_postings' as const, filter: jobFilter }
          : { event: '*' as const, schema: 'public' as const, table: 'job_postings' as const },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            queryClient.setQueryData(['jobs', scope, profile?.organization_id, user?.id], (oldData: JobPosting[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map(job => 
                job.id === payload.new.id 
                  ? { ...job, ...payload.new }
                  : job
              );
            });
          } else {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
          }
        }
      )
      .subscribe();

    // Also listen to job_applications for live count updates
    // No server-side filter possible here (we don't know all job_ids upfront),
    // but the client-side update only applies to matching jobs in cache
    const applicationsChannel = supabase
      .channel(`job-apps-rt-${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_applications'
        },
        (payload) => {
          queryClient.setQueryData(['jobs', scope, profile?.organization_id, user?.id], (oldData: JobPosting[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map(job => 
              job.id === payload.new.job_id 
                ? { ...job, applications_count: job.applications_count + 1 }
                : job
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(applicationsChannel);
    };
  }, [enableRealtime, user, queryClient, scope, profile?.organization_id]);

  // Memoize stats to prevent unnecessary recalculations
  // Only count truly active jobs (is_active AND not expired) for dashboard stats
  const activeJobsList = useMemo(() => 
    jobs.filter(job => job.is_active && !isJobExpiredCheck(job.created_at, job.expires_at)), 
    [jobs]
  );
  
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
