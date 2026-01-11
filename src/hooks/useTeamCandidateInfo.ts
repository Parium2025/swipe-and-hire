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
 * Used to show "Added by colleague X" indicators in the candidates table
 */
export function useTeamCandidateInfo(applicationIds: string[]) {
  const { user } = useAuth();
  const { teamMembers } = useTeamMembers();

  const { data: teamCandidates, isLoading } = useQuery({
    queryKey: ['team-candidate-info', applicationIds.sort().join(',')],
    queryFn: async () => {
      if (!user || applicationIds.length === 0) return {};

      // Fetch all my_candidates entries for these applications from any team member
      const { data, error } = await supabase
        .from('my_candidates')
        .select('applicant_id, application_id, recruiter_id, rating, stage')
        .in('application_id', applicationIds);

      if (error) throw error;

      // Create a map of application_id -> array of team members who have added it
      const infoMap: Record<string, TeamCandidateInfo[]> = {};

      // Create a recruiter name lookup
      const recruiterNames: Record<string, string> = {};
      teamMembers.forEach(member => {
        recruiterNames[member.userId] = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Kollega';
      });
      // Add current user
      recruiterNames[user.id] = 'Du';

      data?.forEach(candidate => {
        const appId = candidate.application_id;
        if (!infoMap[appId]) {
          infoMap[appId] = [];
        }

        const recruiterName = recruiterNames[candidate.recruiter_id] || 'Kollega';
        
        infoMap[appId].push({
          applicant_id: candidate.applicant_id,
          application_id: candidate.application_id,
          recruiter_id: candidate.recruiter_id,
          recruiter_name: recruiterName,
          rating: candidate.rating || 0,
          stage: candidate.stage,
        });
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
