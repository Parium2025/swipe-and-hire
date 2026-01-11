import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// Page size for pagination - optimized for performance
const PAGE_SIZE = 50;

export function useMyCandidatesData(searchQuery: string = '') {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);

  // Use infinite query for scalable pagination (handles 100k+ candidates)
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['my-candidates', user?.id, searchQuery],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!user) return { items: [], nextCursor: null };

      // If search query exists, use Full-Text Search RPC for blazing fast filtering
      if (searchQuery && searchQuery.trim()) {
        const { data: searchResults, error: searchError } = await supabase.rpc('search_my_candidates', {
          p_recruiter_id: user.id,
          p_search_query: searchQuery.trim(),
          p_limit: PAGE_SIZE,
          p_cursor_updated_at: pageParam || null,
        });

        if (searchError) throw searchError;
        if (!searchResults || searchResults.length === 0) {
          return { items: [], nextCursor: null };
        }

        // Get application details for the search results
        const applicationIds = searchResults.map((r: any) => r.application_id);
        const applicantIds = [...new Set(searchResults.map((r: any) => r.applicant_id))];

        // Fetch job applications data
        const { data: applications, error: appError } = await supabase
          .from('job_applications')
          .select(`
            id, applicant_id, first_name, last_name, email, phone, location, bio,
            cv_url, age, employment_status, work_schedule, availability, custom_answers,
            status, applied_at, viewed_at, job_postings!inner(title)
          `)
          .in('id', applicationIds);

        if (appError) throw appError;
        const appMap = new Map(applications?.map(app => [app.id, app]) || []);

        // Fetch profile media batch
        const profileMediaMap: Record<string, any> = {};
        const { data: batchMediaData } = await supabase.rpc('get_applicant_profile_media_batch', {
          p_applicant_ids: applicantIds,
          p_employer_id: user.id,
        });

        if (batchMediaData) {
          batchMediaData.forEach((row: any) => {
            profileMediaMap[row.applicant_id] = {
              profile_image_url: row.profile_image_url,
              video_url: row.video_url,
              is_profile_video: row.is_profile_video,
              last_active_at: row.last_active_at || null,
            };
          });
        }

        // Fetch activity data
        const activityMap: Record<string, any> = {};
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

        // Combine data
        const items: MyCandidateData[] = searchResults.map((mc: any) => {
          const app = appMap.get(mc.application_id);
          const media = profileMediaMap[mc.applicant_id] || {};
          const activity = activityMap[mc.applicant_id] || {};

          return {
            id: mc.my_candidate_id,
            recruiter_id: user.id,
            applicant_id: mc.applicant_id,
            application_id: mc.application_id,
            job_id: mc.job_id,
            stage: mc.stage,
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
            profile_image_url: media.profile_image_url || null,
            video_url: media.video_url || null,
            is_profile_video: media.is_profile_video || null,
            applied_at: app?.applied_at || null,
            viewed_at: app?.viewed_at || null,
            latest_application_at: activity.latest_application_at || null,
            last_active_at: (activity.last_active_at ?? media.last_active_at) || null,
          };
        });

        const lastItem = searchResults[searchResults.length - 1];
        const nextCursor = searchResults.length === PAGE_SIZE ? lastItem.updated_at : null;

        return { items, nextCursor };
      }

      // No search query - use standard query with cursor-based pagination
      let query = supabase
        .from('my_candidates')
        .select('*')
        .eq('recruiter_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(PAGE_SIZE);

      // Apply cursor for pagination
      if (pageParam) {
        query = query.lt('updated_at', pageParam);
      }

      const { data: myCandidates, error: mcError } = await query;

      if (mcError) throw mcError;
      if (!myCandidates || myCandidates.length === 0) {
        return { items: [], nextCursor: null };
      }

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

      // Fetch profile media for all applicants in ONE batch call (scales to millions)
      const applicantIds = [...new Set(myCandidates.map(mc => mc.applicant_id))];
      const profileMediaMap: Record<string, { profile_image_url: string | null; video_url: string | null; is_profile_video: boolean | null; last_active_at: string | null }> = {};

      // Single batch RPC call instead of N individual calls - critical for 10M+ users
      const { data: batchMediaData } = await supabase.rpc('get_applicant_profile_media_batch', {
        p_applicant_ids: applicantIds,
        p_employer_id: user.id,
      });

      if (batchMediaData && Array.isArray(batchMediaData)) {
        batchMediaData.forEach((row: any) => {
          profileMediaMap[row.applicant_id] = {
            profile_image_url: row.profile_image_url,
            video_url: row.video_url,
            is_profile_video: row.is_profile_video,
            last_active_at: row.last_active_at || null,
          };
        });
      }

      // Fill in nulls for any applicants not returned
      applicantIds.forEach((id) => {
        if (!profileMediaMap[id]) {
          profileMediaMap[id] = {
            profile_image_url: null,
            video_url: null,
            is_profile_video: null,
            last_active_at: null,
          };
        }
      });

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
      const items: MyCandidateData[] = myCandidates.map(mc => {
        const app = appMap.get(mc.application_id);
        const media = profileMediaMap[mc.applicant_id] || { profile_image_url: null, video_url: null, is_profile_video: null, last_active_at: null };
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
          last_active_at: activity.last_active_at ?? media.last_active_at,
        };
      });

      // Determine next cursor for pagination
      const lastItem = myCandidates[myCandidates.length - 1];
      const nextCursor = myCandidates.length === PAGE_SIZE ? lastItem.updated_at : null;

      return { items, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
    staleTime: 0, // Always fresh data for real-time experience
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // PRE-FETCHING: Automatically load next batch in background after each page loads
  // This makes scrolling feel instant - data is ready before user reaches bottom
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && data?.pages && data.pages.length > 0) {
      // Small delay to avoid blocking the main thread
      const timer = setTimeout(() => {
        fetchNextPage();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data?.pages?.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages into single array
  const candidates = useMemo(() => {
    return data?.pages.flatMap(page => page.items) || [];
  }, [data]);

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
                (old: any) => {
                  if (!old?.pages) return old;
                  return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                      ...page,
                      items: page.items.map((c: MyCandidateData) =>
                        c.id === next.id ? { ...c, stage: next.stage! } : c
                      ),
                    })),
                  };
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

  // Real-time subscription for activity updates (profiles.last_active_at and job_applications)
  useEffect(() => {
    if (!user || candidates.length === 0) return;

    const applicantIds = [...new Set(candidates.map(c => c.applicant_id))];

    // Listen for profile updates (last_active_at changes)
    const profilesChannel = supabase
      .channel('candidate-activity-profiles')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload: any) => {
          const updatedUserId = payload.new?.user_id;
          if (updatedUserId && applicantIds.includes(updatedUserId)) {
            const newLastActiveAt = payload.new?.last_active_at;
            // Update the specific candidate's last_active_at in cache (paginated structure)
            queryClient.setQueryData(
              ['my-candidates', user.id],
              (old: any) => {
                if (!old?.pages) return old;
                return {
                  ...old,
                  pages: old.pages.map((page: any) => ({
                    ...page,
                    items: page.items.map((c: MyCandidateData) =>
                      c.applicant_id === updatedUserId
                        ? { ...c, last_active_at: newLastActiveAt }
                        : c
                    ),
                  })),
                };
              }
            );
          }
        }
      )
      .subscribe();

    // Listen for new job applications (latest_application_at changes)
    const applicationsChannel = supabase
      .channel('candidate-activity-applications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_applications',
        },
        (payload: any) => {
          const applicantId = payload.new?.applicant_id;
          const appliedAt = payload.new?.applied_at;
          if (applicantId && applicantIds.includes(applicantId) && appliedAt) {
            // Update the specific candidate's latest_application_at in cache (paginated structure)
            queryClient.setQueryData(
              ['my-candidates', user.id],
              (old: any) => {
                if (!old?.pages) return old;
                return {
                  ...old,
                  pages: old.pages.map((page: any) => ({
                    ...page,
                    items: page.items.map((c: MyCandidateData) =>
                      c.applicant_id === applicantId
                        ? { ...c, latest_application_at: appliedAt }
                        : c
                    ),
                  })),
                };
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(applicationsChannel);
    };
  }, [user, candidates, queryClient]);

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

  // Add multiple candidates at once (bulk action)
  const addCandidates = useMutation({
    mutationFn: async (candidates: Array<{ applicationId: string; applicantId: string; jobId?: string }>) => {
      if (!user) throw new Error('Not authenticated');

      // First, check which candidates already exist in my_candidates
      const applicationIds = candidates.map(c => c.applicationId);
      const { data: existing } = await supabase
        .from('my_candidates')
        .select('application_id')
        .eq('recruiter_id', user.id)
        .in('application_id', applicationIds);

      const existingIds = new Set(existing?.map(e => e.application_id) || []);
      
      // Filter out candidates that already exist
      const newCandidates = candidates.filter(c => !existingIds.has(c.applicationId));
      
      if (newCandidates.length === 0) {
        return { inserted: 0, alreadyExisted: candidates.length };
      }

      // Get the user's stage settings to find the first available stage
      const { data: stageSettings } = await supabase
        .from('user_stage_settings')
        .select('stage_key, order_index, custom_label')
        .eq('user_id', user.id)
        .gt('order_index', -1) // Exclude deleted stages
        .order('order_index', { ascending: true })
        .limit(1);

      // Use the first available stage, or fall back to 'to_contact' if no stages configured
      const defaultStage = stageSettings?.[0]?.stage_key || 'to_contact';

      const insertData = newCandidates.map(c => ({
        recruiter_id: user.id,
        applicant_id: c.applicantId,
        application_id: c.applicationId,
        job_id: c.jobId || null,
        stage: defaultStage,
      }));

      const { data, error } = await supabase
        .from('my_candidates')
        .insert(insertData)
        .select();

      if (error) throw error;
      return { inserted: data?.length || 0, alreadyExisted: existingIds.size };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
      if (result.inserted > 0) {
        toast.success(`${result.inserted} kandidat${result.inserted !== 1 ? 'er' : ''} tillagd${result.inserted !== 1 ? 'a' : ''} i din lista`);
      } else if (result.alreadyExisted > 0) {
        toast.info('Kandidaterna finns redan i din lista');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Kunde inte lägga till kandidaterna');
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

      // Optimistic update - MUST be synchronous to feel instant (paginated structure)
      void queryClient.cancelQueries({ queryKey: ['my-candidates', user?.id] });
      const previousCandidates = queryClient.getQueryData(['my-candidates', user?.id]);

      queryClient.setQueryData(['my-candidates', user?.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((c: MyCandidateData) =>
              c.id === id ? { ...c, stage } : c
            ),
          })),
        };
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
      // Optimistic update (paginated structure)
      await queryClient.cancelQueries({ queryKey: ['my-candidates', user?.id] });
      const previousCandidates = queryClient.getQueryData(['my-candidates', user?.id]);
      
      queryClient.setQueryData(['my-candidates', user?.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((c: MyCandidateData) =>
              c.id === id ? { ...c, rating } : c
            ),
          })),
        };
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
      // Optimistic update (paginated structure)
      await queryClient.cancelQueries({ queryKey: ['my-candidates', user?.id] });
      
      queryClient.setQueryData(['my-candidates', user?.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((c: MyCandidateData) =>
              c.application_id === applicationId 
                ? { ...c, viewed_at: new Date().toISOString() } 
                : c
            ),
          })),
        };
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
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    addCandidate,
    addCandidates,
    moveCandidate,
    removeCandidate,
    updateNotes,
    updateRating,
    isInMyCandidates,
    markAsViewed,
  };
}
