import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ActivityType = 'rating_changed' | 'note_added' | 'note_edited';

export interface CandidateActivity {
  id: string;
  applicant_id: string;
  user_id: string;
  activity_type: ActivityType;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  // Joined data
  user_first_name?: string;
  user_last_name?: string;
}

export function useCandidateActivities(applicantId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['candidate-activities', applicantId],
    queryFn: async () => {
      if (!applicantId || !user) return [];

      // Fetch activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('candidate_activities')
        .select('*')
        .eq('applicant_id', applicantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (activitiesError) throw activitiesError;
      if (!activitiesData || activitiesData.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(activitiesData.map(a => a.user_id))];

      // Fetch user profiles for names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      // Combine data
      return activitiesData.map(activity => ({
        ...activity,
        activity_type: activity.activity_type as ActivityType,
        user_first_name: profileMap.get(activity.user_id)?.first_name || 'Okänd',
        user_last_name: profileMap.get(activity.user_id)?.last_name || '',
      })) as CandidateActivity[];
    },
    enabled: !!applicantId && !!user,
    staleTime: 30 * 1000,
  });

  const logActivity = useMutation({
    mutationFn: async ({
      applicantId,
      activityType,
      oldValue,
      newValue,
      metadata,
    }: {
      applicantId: string;
      activityType: ActivityType;
      oldValue?: string | null;
      newValue?: string | null;
      metadata?: Record<string, any>;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('candidate_activities')
        .insert({
          applicant_id: applicantId,
          user_id: user.id,
          activity_type: activityType,
          old_value: oldValue || null,
          new_value: newValue || null,
          metadata: metadata || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['candidate-activities', variables.applicantId] });
    },
  });

  const deleteNoteActivities = useMutation({
    mutationFn: async ({
      applicantId,
    }: {
      applicantId: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Delete all note-related activities for this applicant by this user
      const { error } = await supabase
        .from('candidate_activities')
        .delete()
        .eq('applicant_id', applicantId)
        .eq('user_id', user.id)
        .in('activity_type', ['note_added', 'note_edited']);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['candidate-activities', variables.applicantId] });
    },
  });

  return {
    activities,
    isLoading,
    error,
    logActivity,
    deleteNoteActivities,
  };
}
