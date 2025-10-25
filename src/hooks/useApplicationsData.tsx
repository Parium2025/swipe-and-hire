import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface ApplicationData {
  id: string;
  job_id: string;
  applicant_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  cv_url: string | null;
  age: number | null;
  employment_status: string | null;
  availability: string | null;
  status: string | null;
  applied_at: string;
  updated_at: string;
  custom_answers: any;
  job_title?: string;
  profile_image_url?: string | null;
}

export const useApplicationsData = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const CACHE_KEY = user ? `applications_cache_${user.id}` : null;

  const { data: applications = [], isLoading, error, refetch } = useQuery({
    queryKey: ['applications', user?.id],
    queryFn: async () => {
      console.time('⏱️ DB optimized Applications query');
      
      if (!user) {
        console.timeEnd('⏱️ DB optimized Applications query');
        return [];
      }
      
      // RLS handles organization filtering - no need for explicit org filter
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          first_name,
          last_name,
          email,
          status,
          applied_at,
          updated_at,
          job_postings(
            title
          ),
          profiles(
            profile_image_url
          )
        `)
        .order('applied_at', { ascending: false });

      console.timeEnd('⏱️ DB optimized Applications query');

      if (error) throw error;

      // Transform data to flatten the structure
      const mapped = (data || []).map((app: any) => ({
        ...app,
        job_title: app.job_postings?.title,
        profile_image_url: app.profiles?.profile_image_url,
      })) as ApplicationData[];

      // Cache for instant next load
      try {
        if (CACHE_KEY) sessionStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
      } catch {}

      return mapped;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    initialData: () => {
      try {
        return CACHE_KEY ? JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null') : undefined;
      } catch {
        return undefined;
      }
    },
    initialDataUpdatedAt: Date.now() - 30 * 1000,
  });

  const stats = {
    total: applications.length,
    new: applications.filter(app => app.status === 'pending').length,
    reviewing: applications.filter(app => app.status === 'reviewing').length,
    accepted: applications.filter(app => app.status === 'accepted').length,
    rejected: applications.filter(app => app.status === 'rejected').length,
  };

  const invalidateApplications = () => {
    queryClient.invalidateQueries({ queryKey: ['applications'] });
  };

  return {
    applications,
    stats,
    isLoading,
    error,
    refetch,
    invalidateApplications,
  };
};
