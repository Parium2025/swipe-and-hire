import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useCallback } from 'react';

interface Application {
  id: string;
  job_id: string;
  status: string;
  applied_at: string;
  created_at: string;
  job_postings: {
    id: string;
    title: string;
    location: string | null;
    employment_type: string | null;
    workplace_city: string | null;
    workplace_county: string | null;
    is_active: boolean | null;
    created_at: string;
    expires_at: string | null;
    deleted_at: string | null;
    applications_count: number | null;
    profiles: {
      company_name: string | null;
      company_logo_url: string | null;
    } | null;
  } | null;
}

// LocalStorage cache for instant load - no expiry, background sync keeps fresh
const CACHE_KEY = 'parium_my_applications_cache';

interface CachedData {
  applications: Application[];
  userId: string;
  timestamp: number;
}

function readCache(userId: string): Application[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    // Only use cache if it's for the same user
    if (cached.userId !== userId) return null;
    return cached.applications;
  } catch {
    return null;
  }
}

function writeCache(userId: string, applications: Application[]): void {
  try {
    const cached: CachedData = { 
      applications: applications.slice(0, 50), // Max 50 items to save space
      userId, 
      timestamp: Date.now() 
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage full
  }
}

/**
 * Hook to fetch job seeker's applications with instant load from localStorage
 * and real-time background sync.
 */
export function useMyApplicationsCache() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check for cached data
  const hasCachedData = user ? readCache(user.id) !== null : false;

  const { data: applications = [], isLoading: queryLoading, error, refetch } = useQuery({
    queryKey: ['my-applications', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          job_id,
          status,
          applied_at,
          created_at,
          job_postings (
            id,
            title,
            location,
            employment_type,
            workplace_city,
            workplace_county,
            is_active,
            created_at,
            expires_at,
            deleted_at,
            applications_count,
            profiles:employer_id (
              company_name,
              company_logo_url
            )
          )
        `)
        .eq('applicant_id', user.id)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      
      const apps = (data || []) as Application[];
      
      // Update cache with fresh data
      writeCache(user.id, apps);
      
      return apps;
    },
    enabled: !!user,
    staleTime: Infinity, // Never refetch — realtime handles all updates
    gcTime: Infinity,
    // Instant load from localStorage cache
    initialData: () => {
      if (!user) return undefined;
      const cached = readCache(user.id);
      return cached ?? undefined;
    },
    initialDataUpdatedAt: () => {
      if (!user) return undefined;
      const cached = readCache(user.id);
      return cached ? Date.now() - 60000 : undefined; // Trigger background refetch
    },
  });

  // Only show loading if we don't have cached data
  const isLoading = queryLoading && !hasCachedData;

  // Real-time subscription for application updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('my-applications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `applicant_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-applications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Real-time subscription for job posting updates (applications_count, deleted_at, expires_at)
  useEffect(() => {
    if (!user || !applications.length) return;

    const channel = supabase
      .channel('my-applications-jobs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_postings',
        },
        (payload) => {
          // Update cache with new job data
          queryClient.setQueryData(['my-applications', user.id], (oldData: Application[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map(application => {
              if (application.job_postings && application.job_postings.id === payload.new.id) {
                return {
                  ...application,
                  job_postings: {
                    ...application.job_postings,
                    applications_count: payload.new.applications_count,
                    is_active: payload.new.is_active,
                    expires_at: payload.new.expires_at,
                    deleted_at: payload.new.deleted_at,
                  }
                };
              }
              return application;
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, applications.length, queryClient]);

  // Optimistic delete function
  const deleteApplication = useCallback(async (applicationId: string) => {
    if (!user) return;

    // Optimistic update
    queryClient.setQueryData(['my-applications', user.id], (old: Application[] | undefined) => {
      const updated = old?.filter(app => app.id !== applicationId) || [];
      writeCache(user.id, updated);
      return updated;
    });

    try {
      const { error } = await supabase
        .from('job_applications')
        .delete()
        .eq('id', applicationId)
        .eq('applicant_id', user.id);

      if (error) throw error;
      
      // Invalidate the count query
      queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
    } catch (err) {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ['my-applications', user.id] });
      throw err;
    }
  }, [user, queryClient]);

  return {
    applications,
    isLoading,
    error,
    refetch,
    deleteApplication,
  };
}
