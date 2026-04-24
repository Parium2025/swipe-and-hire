import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { safeSetItem } from '@/lib/safeStorage';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ActivityType = 'rating_changed' | 'note_added' | 'note_edited' | 'added_to_pipeline';

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

const ACTIVITY_CACHE_KEY = 'parium_candidate_activities_';

function readActivityCache(applicantId: string): CandidateActivity[] | null {
  const key = ACTIVITY_CACHE_KEY + applicantId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.data)) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return null;
    }
    return parsed.data;
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
}

function writeActivityCache(applicantId: string, data: CandidateActivity[]): void {
  try {
    safeSetItem(ACTIVITY_CACHE_KEY + applicantId, JSON.stringify({ data: data.slice(0, 50), timestamp: Date.now() }));
  } catch { /* storage full */ }
}

/**
 * Shared queryFn for candidate activities — used by both the hook and prefetch.
 */
async function fetchActivitiesQueryFn(applicantId: string): Promise<CandidateActivity[]> {
  const { data: activitiesData, error: activitiesError } = await supabase
    .from('candidate_activities')
    .select('*')
    .eq('applicant_id', applicantId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (activitiesError) throw activitiesError;
  if (!activitiesData || activitiesData.length === 0) return [];

  const userIds = [...new Set(activitiesData.map(a => a.user_id))];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', userIds);

  const profileMap = new Map(
    (profiles || []).map(p => [p.user_id, p])
  );

  const result = activitiesData.map(activity => ({
    ...activity,
    activity_type: activity.activity_type as ActivityType,
    user_first_name: profileMap.get(activity.user_id)?.first_name || 'Okänd',
    user_last_name: profileMap.get(activity.user_id)?.last_name || '',
  })) as CandidateActivity[];

  writeActivityCache(applicantId, result);
  return result;
}

export function useCandidateActivities(applicantId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['candidate-activities', applicantId],
    queryFn: () => fetchActivitiesQueryFn(applicantId!),
    enabled: !!applicantId && !!user,
    staleTime: 30 * 1000,
    initialData: () => {
      if (!applicantId) return undefined;
      return readActivityCache(applicantId) ?? undefined;
    },
    initialDataUpdatedAt: () => {
      if (!applicantId) return undefined;
      return readActivityCache(applicantId) ? 0 : undefined;
    },
  });

  // Real-time subscription for activity updates
  useEffect(() => {
    if (!applicantId || !user) return;

    const channel = supabase
      .channel(`candidate-activities-${applicantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidate_activities',
          filter: `applicant_id=eq.${applicantId}`,
        },
        () => {
          // Invalidate and refetch when activities change
          queryClient.invalidateQueries({ queryKey: ['candidate-activities', applicantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applicantId, user, queryClient]);

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
      // Use the database function to delete all note activities for this applicant
      // This works regardless of who created the activity
      const { error } = await supabase.rpc('delete_note_activities_for_applicant', {
        p_applicant_id: applicantId,
      });

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

/**
 * Prefetch activities for a candidate (call on hover).
 * Reuses the same queryFn as the hook — single source of truth.
 */
export function prefetchCandidateActivities(queryClient: ReturnType<typeof useQueryClient>, applicantId: string, _userId?: string) {
  queryClient.prefetchQuery({
    queryKey: ['candidate-activities', applicantId],
    queryFn: () => fetchActivitiesQueryFn(applicantId),
    staleTime: 30 * 1000,
  });
}
