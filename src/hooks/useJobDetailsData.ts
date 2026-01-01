import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Types for criterion results
interface CriterionResult {
  criterion_id: string;
  result: 'match' | 'no_match' | 'no_data';
  reasoning?: string;
  title: string;
}

export interface JobApplication {
  id: string;
  applicant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  age: number;
  location: string;
  bio: string;
  cv_url: string;
  employment_status: string;
  availability: string;
  applied_at: string;
  status: 'pending' | 'reviewing' | 'interview' | 'offered' | 'hired' | 'rejected';
  custom_answers: any;
  viewed_at: string | null;
  profile_image_url: string | null;
  video_url: string | null;
  is_profile_video: boolean;
  rating: number;
  criterionResults?: CriterionResult[];
}

export interface JobPosting {
  id: string;
  title: string;
  location: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  created_at: string;
}

// Fetch job details
async function fetchJobDetails(jobId: string, userId: string): Promise<JobPosting | null> {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', jobId)
    .eq('employer_id', userId)
    .single();
  
  if (error) throw error;
  return data;
}

// Fetch applications with all related data
async function fetchApplications(jobId: string, userId: string): Promise<JobApplication[]> {
  // Fetch applications
  const { data: applicationsData, error: applicationsError } = await supabase
    .from('job_applications')
    .select('*')
    .eq('job_id', jobId)
    .order('applied_at', { ascending: false });

  if (applicationsError) throw applicationsError;
  if (!applicationsData || applicationsData.length === 0) return [];

  const applicantIds = applicationsData.map(a => a.applicant_id);

  // Parallel fetch all related data
  const [myCandidatesResult, criteriaResult, evaluationsResult] = await Promise.all([
    // Fetch ratings
    supabase
      .from('my_candidates')
      .select('applicant_id, rating')
      .eq('recruiter_id', userId)
      .in('applicant_id', applicantIds),
    // Fetch criteria titles
    supabase
      .from('job_criteria')
      .select('id, title')
      .eq('job_id', jobId),
    // Fetch evaluations
    supabase
      .from('candidate_evaluations')
      .select('id, applicant_id')
      .eq('job_id', jobId)
      .in('applicant_id', applicantIds),
  ]);

  const ratingsByApplicant = new Map<string, number>();
  (myCandidatesResult.data || []).forEach(mc => {
    ratingsByApplicant.set(mc.applicant_id, mc.rating || 0);
  });

  const criteriaMap = new Map<string, string>();
  (criteriaResult.data || []).forEach(c => criteriaMap.set(c.id, c.title));

  const evaluationByApplicant = new Map<string, string>();
  (evaluationsResult.data || []).forEach(e => evaluationByApplicant.set(e.applicant_id, e.id));

  // Fetch criterion results if we have evaluations
  const evaluationIds = (evaluationsResult.data || []).map(e => e.id);
  let resultsByEvaluation = new Map<string, CriterionResult[]>();
  
  if (evaluationIds.length > 0) {
    const { data: criterionResultsData } = await supabase
      .from('criterion_results')
      .select('evaluation_id, criterion_id, result, reasoning')
      .in('evaluation_id', evaluationIds);

    (criterionResultsData || []).forEach(cr => {
      const title = criteriaMap.get(cr.criterion_id) || 'Okänt kriterium';
      const result: CriterionResult = {
        criterion_id: cr.criterion_id,
        result: cr.result as 'match' | 'no_match' | 'no_data',
        reasoning: cr.reasoning || undefined,
        title,
      };
      const existing = resultsByEvaluation.get(cr.evaluation_id) || [];
      existing.push(result);
      resultsByEvaluation.set(cr.evaluation_id, existing);
    });
  }

  // Fetch profile media in parallel (batch RPC calls)
  const mediaPromises = applicationsData.map(app => 
    supabase.rpc('get_applicant_profile_media', {
      p_applicant_id: app.applicant_id,
      p_employer_id: userId
    })
  );
  const mediaResults = await Promise.all(mediaPromises);

  // Combine all data
  return applicationsData.map((app, index) => {
    const media = (mediaResults[index].data?.[0] || {}) as {
      profile_image_url?: string;
      video_url?: string;
      is_profile_video?: boolean;
    };
    const evalId = evaluationByApplicant.get(app.applicant_id);
    const criterionResults = evalId ? resultsByEvaluation.get(evalId) || [] : [];

    return {
      ...app,
      profile_image_url: media.profile_image_url || null,
      video_url: media.video_url || null,
      is_profile_video: media.is_profile_video || false,
      rating: ratingsByApplicant.get(app.applicant_id) || 0,
      criterionResults,
    } as JobApplication;
  });
}

export function useJobDetailsData(jobId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Job details query - cached for 5 min, stale after 30s
  const jobQuery = useQuery({
    queryKey: ['job-details', jobId],
    queryFn: () => fetchJobDetails(jobId!, user!.id),
    enabled: !!jobId && !!user,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Applications query - cached and shows stale data while refetching
  const applicationsQuery = useQuery({
    queryKey: ['job-applications', jobId],
    queryFn: () => fetchApplications(jobId!, user!.id),
    enabled: !!jobId && !!user,
    staleTime: 15 * 1000, // 15 seconds - show cached data for 15s
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false, // Don't refetch on tab switch
  });

  // Real-time subscription for application updates
  useEffect(() => {
    if (!jobId || !user) return;

    const channel = supabase
      .channel(`job-applications-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          // Optimistically update the cache
          if (payload.eventType === 'UPDATE') {
            queryClient.setQueryData(['job-applications', jobId], (old: JobApplication[] | undefined) => {
              if (!old) return old;
              return old.map(app => 
                app.id === payload.new.id 
                  ? { ...app, ...payload.new }
                  : app
              );
            });
          } else if (payload.eventType === 'INSERT') {
            // Refetch to get full data including profile media
            queryClient.invalidateQueries({ queryKey: ['job-applications', jobId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, user, queryClient]);

  // Helper to update application locally
  const updateApplicationLocally = (applicationId: string, updates: Partial<JobApplication>) => {
    queryClient.setQueryData(['job-applications', jobId], (old: JobApplication[] | undefined) => {
      if (!old) return old;
      return old.map(app => 
        app.id === applicationId ? { ...app, ...updates } : app
      );
    });
  };

  // Helper to update job locally
  const updateJobLocally = (updates: Partial<JobPosting>) => {
    queryClient.setQueryData(['job-details', jobId], (old: JobPosting | null | undefined) => {
      if (!old) return old;
      return { ...old, ...updates };
    });
  };

  // Refetch both
  const refetch = () => {
    jobQuery.refetch();
    applicationsQuery.refetch();
  };

  return {
    job: jobQuery.data ?? null,
    applications: applicationsQuery.data ?? [],
    isLoading: jobQuery.isLoading || applicationsQuery.isLoading,
    isFetching: jobQuery.isFetching || applicationsQuery.isFetching,
    error: jobQuery.error || applicationsQuery.error,
    updateApplicationLocally,
    updateJobLocally,
    refetch,
  };
}

// Prefetch function to call from job list
export function prefetchJobDetails(jobId: string, userId: string, queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.prefetchQuery({
    queryKey: ['job-details', jobId],
    queryFn: () => fetchJobDetails(jobId, userId),
    staleTime: 30 * 1000,
  });
  queryClient.prefetchQuery({
    queryKey: ['job-applications', jobId],
    queryFn: () => fetchApplications(jobId, userId),
    staleTime: 15 * 1000,
  });
}
