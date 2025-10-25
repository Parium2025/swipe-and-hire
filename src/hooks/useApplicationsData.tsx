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

  // Use cached orgId as fallback for faster initial query
  const cachedOrgId = typeof window !== 'undefined' 
    ? localStorage.getItem('org_id') 
    : null;
  
  const effectiveOrgId = profile?.organization_id ?? cachedOrgId ?? null;
  const profileLoading = user && !effectiveOrgId;

  const { data: applications = [], isLoading, error, refetch } = useQuery({
    queryKey: ['applications', effectiveOrgId],
    queryFn: async () => {
      console.time('⏱️ Applications query');
      
      if (!user || !effectiveOrgId) {
        console.timeEnd('⏱️ Applications query');
        return [];
      }
      
      // Lighter payload - only fetch fields needed for list view
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
          job_postings!inner(
            title,
            organization_id
          ),
          profiles(
            profile_image_url
          )
        `)
        .eq('job_postings.organization_id', effectiveOrgId)
        .order('applied_at', { ascending: false });

      console.timeEnd('⏱️ Applications query');

      if (error) throw error;

      // Transform data to flatten the structure
      return (data || []).map((app: any) => ({
        ...app,
        job_title: app.job_postings?.title,
        profile_image_url: app.profiles?.profile_image_url,
      })) as ApplicationData[];
    },
    enabled: !!user && !!effectiveOrgId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
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
    isLoading: isLoading || profileLoading,
    error,
    refetch,
    invalidateApplications,
  };
};
