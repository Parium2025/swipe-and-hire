import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMembers } from '@/hooks/useTeamMembers';

interface TeamCandidateInfo {
  applicant_id: string;
  application_id: string;
  recruiter_id: string;
  recruiter_name: string;
  rating: number;
  stage: string;
}

/**
 * Hook to fetch info about which team members have added specific candidates
 * Uses persistent candidate_ratings table for ratings (survives remove/re-add)
 * Used to show "Added by colleague X" indicators and ratings in the candidates table
 */
export function useTeamCandidateInfo(applicationIds: string[]) {
  const { user } = useAuth();
  const { teamMembers } = useTeamMembers();

  const { data: teamCandidates, isLoading } = useQuery({
    queryKey: ['team-candidate-info', applicationIds.sort().join(',')],
    queryFn: async () => {
      if (!user || applicationIds.length === 0) return {};

      // Fetch all my_candidates entries for these applications from any team member
      const { data: myCandidatesData, error: mcError } = await supabase
        .from('my_candidates')
        .select('applicant_id, application_id, recruiter_id, rating, stage')
        .in('application_id', applicationIds);

      if (mcError) throw mcError;

      // Get unique applicant IDs to fetch persistent ratings
      const applicantIds = [...new Set(myCandidatesData?.map(c => c.applicant_id) || [])];

      // Fetch persistent ratings for all relevant applicants
      const { data: persistentRatings } = await supabase
        .from('candidate_ratings')
        .select('applicant_id, recruiter_id, rating')
        .in('applicant_id', applicantIds);

      // Create a lookup map for persistent ratings: applicant_id -> recruiter_id -> rating
      const persistentRatingMap: Record<string, Record<string, number>> = {};
      persistentRatings?.forEach(r => {
        if (!persistentRatingMap[r.applicant_id]) {
          persistentRatingMap[r.applicant_id] = {};
        }
        persistentRatingMap[r.applicant_id][r.recruiter_id] = r.rating;
      });

      // Create a map of application_id -> array of team members who have added it
      const infoMap: Record<string, TeamCandidateInfo[]> = {};

      // Create a recruiter name lookup
      const recruiterNames: Record<string, string> = {};
      teamMembers.forEach(member => {
        recruiterNames[member.userId] = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Kollega';
      });
      // Add current user
      recruiterNames[user.id] = 'Du';

      myCandidatesData?.forEach(candidate => {
        const appId = candidate.application_id;
        if (!infoMap[appId]) {
          infoMap[appId] = [];
        }

        const recruiterName = recruiterNames[candidate.recruiter_id] || 'Kollega';
        
        // Use persistent rating if available, otherwise use my_candidates rating
        const persistentRating = persistentRatingMap[candidate.applicant_id]?.[candidate.recruiter_id];
        const effectiveRating = persistentRating ?? candidate.rating ?? 0;
        
        infoMap[appId].push({
          applicant_id: candidate.applicant_id,
          application_id: candidate.application_id,
          recruiter_id: candidate.recruiter_id,
          recruiter_name: recruiterName,
          rating: effectiveRating,
          stage: candidate.stage,
        });
      });

      // Also check for persistent ratings for applicants NOT currently in my_candidates
      // This ensures ratings show even after removal
      const appToApplicant: Record<string, string> = {};
      myCandidatesData?.forEach(c => {
        appToApplicant[c.application_id] = c.applicant_id;
      });

      return infoMap;
    },
    enabled: !!user && applicationIds.length > 0,
    staleTime: 30000,
  });

  return {
    teamCandidates: teamCandidates || {},
    isLoading,
  };
}
