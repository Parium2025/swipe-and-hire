import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MyCandidateData, CandidateStage } from '@/hooks/useMyCandidatesData';
import { toast } from 'sonner';

/**
 * Hook to fetch and manage a colleague's candidates.
 * Used when viewing another team member's candidate list.
 */
export function useColleagueCandidates(colleagueId: string | null) {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<MyCandidateData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchColleagueCandidates = useCallback(async () => {
    if (!colleagueId || !user) {
      setCandidates([]);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch colleague's my_candidates
      const { data: myCandidates, error: mcError } = await supabase
        .from('my_candidates')
        .select('*')
        .eq('recruiter_id', colleagueId)
        .order('updated_at', { ascending: false });

      if (mcError) throw mcError;
      if (!myCandidates || myCandidates.length === 0) {
        setCandidates([]);
        return;
      }

      // Get application IDs to fetch related data
      const applicationIds = myCandidates.map(mc => mc.application_id);

      // Fetch job applications data
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
      const profileMediaMap: Record<string, { profile_image_url: string | null; video_url: string | null; is_profile_video: boolean | null }> = {};

      // Single batch RPC call instead of N individual calls
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

      setCandidates(result);
    } catch (error) {
      console.error('Error fetching colleague candidates:', error);
      toast.error('Kunde inte ladda kollegans kandidater');
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, [colleagueId, user]);

  // Move candidate to different stage (in colleague's list)
  const moveCandidateInColleagueList = async (candidateId: string, newStage: CandidateStage) => {
    const previousCandidates = [...candidates];
    setCandidates(prev => prev.map(c => 
      c.id === candidateId ? { ...c, stage: newStage } : c
    ));

    try {
      const { error } = await supabase
        .from('my_candidates')
        .update({ stage: newStage })
        .eq('id', candidateId);

      if (error) {
        setCandidates(previousCandidates);
        throw error;
      }
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte flytta kandidaten');
    }
  };

  // Remove candidate from colleague's list
  const removeCandidateFromColleagueList = async (candidateId: string) => {
    const previousCandidates = [...candidates];
    setCandidates(prev => prev.filter(c => c.id !== candidateId));

    try {
      const { error } = await supabase
        .from('my_candidates')
        .delete()
        .eq('id', candidateId);

      if (error) {
        setCandidates(previousCandidates);
        throw error;
      }
      toast.success('Kandidat borttagen från kollegans lista');
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte ta bort kandidaten');
    }
  };

  // Add candidate to colleague's list
  const addCandidateToColleagueList = async (
    applicationId: string, 
    applicantId: string, 
    jobId?: string,
    stage: CandidateStage = 'to_contact'
  ) => {
    if (!colleagueId) return;

    try {
      const { data, error } = await supabase
        .from('my_candidates')
        .insert({
          recruiter_id: colleagueId,
          applicant_id: applicantId,
          application_id: applicationId,
          job_id: jobId || null,
          stage,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Kandidaten finns redan i kollegans lista');
        } else {
          throw error;
        }
        return;
      }

      // Refetch to get full data
      await fetchColleagueCandidates();
      toast.success('Kandidat tillagd i kollegans lista');
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte lägga till kandidaten');
    }
  };

  return {
    candidates,
    setCandidates,
    isLoading,
    fetchColleagueCandidates,
    moveCandidateInColleagueList,
    removeCandidateFromColleagueList,
    addCandidateToColleagueList,
  };
}
