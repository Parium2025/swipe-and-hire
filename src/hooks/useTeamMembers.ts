import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TeamMember {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

/**
 * Hook to fetch team members in the same organization.
 * Returns empty array if user is not part of an organization.
 */
export function useTeamMembers() {
  const { user } = useAuth();

  const { data: teamMembers = [], isLoading, error } = useQuery({
    queryKey: ['team-members', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // First, get the user's organization
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!userRole?.organization_id) return [];

      // Get all active users in the same organization (excluding current user)
      const { data: orgMembers, error: membersError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('organization_id', userRole.organization_id)
        .eq('is_active', true)
        .neq('user_id', user.id);

      if (membersError) throw membersError;
      if (!orgMembers || orgMembers.length === 0) return [];

      // Get profile info for each team member
      const memberIds = orgMembers.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, profile_image_url')
        .in('user_id', memberIds);

      if (profilesError) throw profilesError;

      const members: TeamMember[] = (profiles || []).map(p => ({
        userId: p.user_id,
        firstName: p.first_name,
        lastName: p.last_name,
        profileImageUrl: p.profile_image_url,
      }));

      return members;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const hasTeam = teamMembers.length > 0;

  return {
    teamMembers,
    hasTeam,
    isLoading,
    error,
  };
}
