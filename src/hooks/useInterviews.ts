import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Interview {
  id: string;
  job_id: string | null;
  applicant_id: string;
  application_id: string | null;
  employer_id: string;
  scheduled_at: string;
  duration_minutes: number;
  location_type: 'video' | 'office' | 'phone';
  location_details: string | null;
  subject: string | null;
  message: string | null;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
  // Joined data
  candidate_name?: string;
  job_title?: string;
}

export const useInterviews = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch upcoming interviews for employer
  const { data: interviews = [], isLoading, error } = useQuery({
    queryKey: ['interviews', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch interviews with candidate and job info
      const { data, error } = await supabase
        .from('interviews')
        .select(`
          *,
          job_postings(title),
          job_applications(first_name, last_name)
        `)
        .eq('employer_id', user.id)
        .gte('scheduled_at', new Date().toISOString())
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((interview: any) => ({
        ...interview,
        candidate_name: interview.job_applications 
          ? `${interview.job_applications.first_name || ''} ${interview.job_applications.last_name || ''}`.trim() || 'Okänd'
          : 'Okänd',
        job_title: interview.job_postings?.title || 'Okänd tjänst',
      })) as Interview[];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Update interview status
  const updateStatus = useMutation({
    mutationFn: async ({ 
      interviewId, 
      status 
    }: { 
      interviewId: string; 
      status: Interview['status'];
    }) => {
      if (!navigator.onLine) throw new Error('Du är offline');
      
      const { error } = await supabase
        .from('interviews')
        .update({ status })
        .eq('id', interviewId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
    },
  });

  // Cancel interview
  const cancelInterview = useMutation({
    mutationFn: async (interviewId: string) => {
      if (!navigator.onLine) throw new Error('Du är offline');
      
      const { error } = await supabase
        .from('interviews')
        .update({ status: 'cancelled' })
        .eq('id', interviewId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
    },
  });

  return {
    interviews,
    isLoading,
    error,
    updateStatus,
    cancelInterview,
  };
};

// Hook for candidate's interviews
export const useCandidateInterviews = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ['candidate-interviews', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('interviews')
        .select(`
          *,
          job_postings(title, employer_id),
          profiles!interviews_employer_id_fkey(company_name, first_name, last_name)
        `)
        .eq('applicant_id', user.id)
        .gte('scheduled_at', new Date().toISOString())
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds cache like employer side
  });

  // Real-time subscription for interview updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('candidate-interviews-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews',
          filter: `applicant_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['candidate-interviews', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Respond to interview (accept/decline)
  const respondToInterview = useMutation({
    mutationFn: async ({ 
      interviewId, 
      accept 
    }: { 
      interviewId: string; 
      accept: boolean;
    }) => {
      if (!navigator.onLine) throw new Error('Du är offline');
      
      const { error } = await supabase
        .from('interviews')
        .update({ status: accept ? 'confirmed' : 'declined' })
        .eq('id', interviewId)
        .eq('applicant_id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-interviews'] });
    },
  });

  return {
    interviews,
    isLoading,
    respondToInterview,
  };
};
