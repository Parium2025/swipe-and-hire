import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Stage can be a default stage or a custom stage key
export type CandidateStage = string;

export interface MyCandidateData {
  id: string;
  recruiter_id: string;
  applicant_id: string;
  application_id: string;
  job_id: string | null;
  stage: string; // Can be default stage or custom stage key
  notes: string | null;
  rating: number;
  created_at: string;
  updated_at: string;
  // Joined data from job_applications
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  cv_url: string | null;
  age: number | null;
  employment_status: string | null;
  work_schedule: string | null;
  availability: string | null;
  custom_answers: any | null;
  status: string;
  job_title: string | null;
  profile_image_url: string | null;
  video_url: string | null;
  is_profile_video: boolean | null;
  applied_at: string | null;
  viewed_at: string | null;
  // Activity tracking - latest across organization
  latest_application_at: string | null;
  last_active_at: string | null;
}

export const STAGE_CONFIG = {
  to_contact: { label: 'Att kontakta', color: 'bg-blue-500/20 ring-1 ring-inset ring-blue-500/50 text-blue-100', hoverRing: 'ring-blue-500/70' },
  interview: { label: 'Intervju', color: 'bg-yellow-500/20 ring-1 ring-inset ring-yellow-500/50 text-yellow-100', hoverRing: 'ring-yellow-500/70' },
  offer: { label: 'Erbjudande', color: 'bg-purple-500/20 ring-1 ring-inset ring-purple-500/50 text-purple-100', hoverRing: 'ring-purple-500/70' },
  hired: { label: 'Anställd', color: 'bg-green-500/20 ring-1 ring-inset ring-green-500/50 text-green-100', hoverRing: 'ring-green-500/70' },
} as const;

export function useMyCandidatesData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);

  const { data: candidates = [], isLoading, error, refetch } = useQuery({
    queryKey: ['my-candidates', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Fetch my_candidates with joined application data
      const { data: myCandidates, error: mcError } = await supabase
        .from('my_candidates')
        .select('*')
        .eq('recruiter_id', user.id)
        .order('updated_at', { ascending: false });

      if (mcError) throw mcError;
      if (!myCandidates || myCandidates.length === 0) return [];

      // Get application IDs to fetch related data
      const applicationIds = myCandidates.map(mc => mc.application_id);

      // Fetch job applications data - all fields needed for profile dialog
      const { data: applications, error: appError } = await supabase
        .from('job_applications')
        .select(`
          id,
          applicant_id,
          first_name,
          last_name,
          email,
          phone,
          location,
          bio,
          cv_url,
          age,
          employment_status,
          work_schedule,
          availability,
          custom_answers,
          status,
          applied_at,
          viewed_at,
          job_postings!inner(title)
        `)
        .in('id', applicationIds);

      if (appError) throw appError;

      // Create a map for quick lookup
      const appMap = new Map(applications?.map(app => [app.id, app]) || []);

      // Fetch profile media for each applicant
      const applicantIds = [...new Set(myCandidates.map(mc => mc.applicant_id))];
      const profileMediaMap: Record<string, { profile_image_url: string | null; video_url: string | null; is_profile_video: boolean | null }> = {};

      await Promise.all(
        applicantIds.map(async (applicantId) => {
          const { data: mediaData } = await supabase.rpc('get_applicant_profile_media', {
            p_applicant_id: applicantId,
            p_employer_id: user.id,
          });

          if (mediaData && mediaData.length > 0) {
            profileMediaMap[applicantId] = {
              profile_image_url: mediaData[0].profile_image_url,
              video_url: mediaData[0].video_url,
              is_profile_video: mediaData[0].is_profile_video,
            };
          } else {
            profileMediaMap[applicantId] = {
              profile_image_url: null,
              video_url: null,
              is_profile_video: null,
            };
          }
        })
      );

      // Fetch latest activity data (latest_application_at across org + last_active_at)
      const activityMap: Record<string, { latest_application_at: string | null; last_active_at: string | null }> = {};
      const { data: activityData } = await supabase.rpc('get_applicant_latest_activity', {
        p_applicant_ids: applicantIds,
        p_employer_id: user.id,
      });

      if (activityData) {
        activityData.forEach((item: any) => {
          activityMap[item.applicant_id] = {
            latest_application_at: item.latest_application_at,
            last_active_at: item.last_active_at,
          };
        });
      }

      // Combine the data
      const result: MyCandidateData[] = myCandidates.map(mc => {
        const app = appMap.get(mc.application_id);
        const media = profileMediaMap[mc.applicant_id] || { profile_image_url: null, video_url: null, is_profile_video: null };
        const activity = activityMap[mc.applicant_id] || { latest_application_at: null, last_active_at: null };

        return {
          id: mc.id,
          recruiter_id: mc.recruiter_id,
          applicant_id: mc.applicant_id,
          application_id: mc.application_id,
          job_id: mc.job_id,
          stage: mc.stage as CandidateStage,
          notes: mc.notes,
          rating: mc.rating || 0,
          created_at: mc.created_at,
          updated_at: mc.updated_at,
          first_name: app?.first_name || null,
          last_name: app?.last_name || null,
          email: app?.email || null,
          phone: app?.phone || null,
          location: app?.location || null,
          bio: app?.bio || null,
          cv_url: app?.cv_url || null,
          age: app?.age || null,
          employment_status: app?.employment_status || null,
          work_schedule: app?.work_schedule || null,
          availability: app?.availability || null,
          custom_answers: app?.custom_answers || null,
          status: app?.status || 'pending',
          job_title: (app?.job_postings as any)?.title || null,
          profile_image_url: media.profile_image_url,
          video_url: media.video_url,
          is_profile_video: media.is_profile_video,
          applied_at: app?.applied_at || null,
          viewed_at: app?.viewed_at || null,
          latest_application_at: activity.latest_application_at,
          last_active_at: activity.last_active_at,
        };
      });

      return result;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Real-time subscription for my_candidates changes (all users for team sync)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('my-candidates-team-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'my_candidates',
        },
        (payload: any) => {
          // Don't apply realtime changes during drag/drop optimistic updates
          if (isDragging) return;

          // For the common case (stage change), update cache in-place to avoid
          // refetch jitter that makes drag/drop feel "laggy".
          if (payload?.eventType === 'UPDATE' && payload?.new?.id) {
            const next = payload.new as { id: string; stage?: CandidateStage; recruiter_id?: string };

            // Only update if it's the current user's candidate
            if (next.recruiter_id === user.id && next.stage) {
              queryClient.setQueryData(
                ['my-candidates', user.id],
                (old: MyCandidateData[] | undefined) => {
                  if (!old) return old;
                  return old.map((c) => (c.id === next.id ? { ...c, stage: next.stage! } : c));
                }
              );
              return;
            }
          }

          // Fallback: refetch for other changes (insert/delete/unknown updates)
          // This catches changes made by colleagues that affect shared data
          queryClient.invalidateQueries({ queryKey: ['my-candidates', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, isDragging]);

  // Add candidate to my list
  const addCandidate = useMutation({
    mutationFn: async ({ applicationId, applicantId, jobId }: { applicationId: string; applicantId: string; jobId?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('my_candidates')
        .insert({
          recruiter_id: user.id,
          applicant_id: applicantId,
          application_id: applicationId,
          job_id: jobId || null,
          stage: 'to_contact',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Kandidaten finns redan i din lista');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
      toast.success('Kandidat tillagd i din lista');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Kunde inte lägga till kandidaten');
    },
  });

  // Move candidate to different stage
  const moveCandidate = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: CandidateStage }) => {
      const { data, error } = await supabase
        .from('my_candidates')
        .update({ stage })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: ({ id, stage }) => {
      // Mark as dragging to prevent realtime from overwriting
      setIsDragging(true);

      // Optimistic update - MUST be synchronous to feel instant (like JobDetails)
      void queryClient.cancelQueries({ queryKey: ['my-candidates', user?.id] });
      const previousCandidates = queryClient.getQueryData(['my-candidates', user?.id]);

      queryClient.setQueryData(['my-candidates', user?.id], (old: MyCandidateData[] | undefined) => {
        if (!old) return old;
        return old.map((c) => (c.id === id ? { ...c, stage } : c));
      });

      return { previousCandidates };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['my-candidates', user?.id], context?.previousCandidates);
      toast.error('Kunde inte flytta kandidaten');
    },
    onSettled: () => {
      // Only reset dragging state - don't invalidate to avoid flicker
      // The realtime subscription will sync when needed
      setIsDragging(false);
    },
  });

  // Remove candidate from my list
  const removeCandidate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('my_candidates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
      toast.success('Kandidat borttagen från din lista');
    },
    onError: () => {
      toast.error('Kunde inte ta bort kandidaten');
    },
  });

  // Update notes
  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { data, error } = await supabase
        .from('my_candidates')
        .update({ notes })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
    },
    onError: () => {
      toast.error('Kunde inte uppdatera anteckningar');
    },
  });

  // Update rating
  const updateRating = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number }) => {
      const { data, error } = await supabase
        .from('my_candidates')
        .update({ rating })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, rating }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['my-candidates', user?.id] });
      const previousCandidates = queryClient.getQueryData(['my-candidates', user?.id]);
      
      queryClient.setQueryData(['my-candidates', user?.id], (old: MyCandidateData[] | undefined) => {
        if (!old) return old;
        return old.map(c => c.id === id ? { ...c, rating } : c);
      });
      
      return { previousCandidates };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['my-candidates', user?.id], context?.previousCandidates);
      toast.error('Kunde inte uppdatera betyg');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
    },
  });

  // Group candidates by stage
  const candidatesByStage = useMemo(() => {
    const grouped: Record<CandidateStage, MyCandidateData[]> = {
      to_contact: [],
      interview: [],
      offer: [],
      hired: [],
    };

    candidates.forEach(candidate => {
      if (grouped[candidate.stage]) {
        grouped[candidate.stage].push(candidate);
      }
    });

    return grouped;
  }, [candidates]);

  // Stats
  const stats = useMemo(() => ({
    total: candidates.length,
    to_contact: candidatesByStage.to_contact.length,
    interview: candidatesByStage.interview.length,
    offer: candidatesByStage.offer.length,
    hired: candidatesByStage.hired.length,
  }), [candidates, candidatesByStage]);

  // Check if an application is already in my candidates
  const isInMyCandidates = useCallback((applicationId: string) => {
    return candidates.some(c => c.application_id === applicationId);
  }, [candidates]);

  // Mark application as viewed
  const markAsViewed = useMutation({
    mutationFn: async (applicationId: string) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', applicationId)
        .is('viewed_at', null);

      if (error) throw error;
    },
    onMutate: async (applicationId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['my-candidates', user?.id] });
      
      queryClient.setQueryData(['my-candidates', user?.id], (old: MyCandidateData[] | undefined) => {
        if (!old) return old;
        return old.map(c => 
          c.application_id === applicationId 
            ? { ...c, viewed_at: new Date().toISOString() } 
            : c
        );
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  return {
    candidates,
    candidatesByStage,
    stats,
    isLoading,
    error,
    refetch,
    addCandidate,
    moveCandidate,
    removeCandidate,
    updateNotes,
    updateRating,
    isInMyCandidates,
    markAsViewed,
  };
}
