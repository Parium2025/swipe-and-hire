import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeSetItem } from '@/lib/safeStorage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export interface TeamMember {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

// LocalStorage cache for instant load - no expiry, always syncs in background
const CACHE_KEY = 'parium_team_members_cache';

interface CachedData {
  members: TeamMember[];
  userId: string;
  timestamp: number;
}

function readCache(userId: string): TeamMember[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    if (!cached || cached.userId !== userId) return null;
    if (!Array.isArray(cached.members)) {
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
      return null;
    }
    return cached.members;
  } catch {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    return null;
  }
}

function writeCache(userId: string, members: TeamMember[]): void {
  try {
    const cached: CachedData = { members, userId, timestamp: Date.now() };
    safeSetItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage full
  }
}

/**
 * Hook to fetch team members in the same organization.
 * Returns empty array if user is not part of an organization.
 * Instant load from localStorage cache + background sync.
 */
export function useTeamMembers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check for cached data
  const hasCachedData = user ? readCache(user.id) !== null : false;

  const { data: teamMembers = [], isLoading: queryLoading, error } = useQuery({
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

      // Update cache
      writeCache(user.id, members);

      return members;
    },
    enabled: !!user,
    staleTime: Infinity, // Never refetch — realtime handles all updates
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // Instant load from localStorage cache
    initialData: () => {
      if (!user) return undefined;
      const cached = readCache(user.id);
      return cached ?? undefined;
    },
    initialDataUpdatedAt: () => {
      if (!user) return undefined;
      const cached = readCache(user.id);
      return cached ? Date.now() - 60000 : undefined; // Trigger background refetch
    },
  });

  // Only show loading if we don't have cached data
  const isLoading = queryLoading && !hasCachedData;

  // Real-time subscription for team changes - filtered per organization
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const setup = async () => {
      // Hämta org-id en gång för att kunna filtrera realtime per organisation
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (cancelled || !userRole?.organization_id) return;

      const debouncedInvalidate = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['team-members', user.id] });
        }, 2000);
      };

      channel = supabase
        .channel(`team-members-realtime-${userRole.organization_id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_roles',
            filter: `organization_id=eq.${userRole.organization_id}`,
          },
          debouncedInvalidate
        )
        .subscribe();
    };

    setup();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const hasTeam = teamMembers.length > 0;

  return {
    teamMembers,
    hasTeam,
    isLoading,
    error,
  };
}
