import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

export interface ProfileViewStats {
  unique_viewers_30d: number;
  total_views: number;
  last_viewed_at: string | null;
}

const DEFAULT: ProfileViewStats = {
  unique_viewers_30d: 0,
  total_views: 0,
  last_viewed_at: null,
};

/**
 * Antal unika arbetsgivare som öppnat min profil (senaste 30 dagarna)
 * + total antal visningar genom tiderna.
 */
export function useProfileViewStats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['profile-view-stats', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<ProfileViewStats> => {
      if (!userId) return DEFAULT;
      const { data, error } = await supabase.rpc('get_profile_view_stats' as any, {
        p_user_id: userId,
      });
      if (error) return DEFAULT;
      return (data as ProfileViewStats) ?? DEFAULT;
    },
  });

  // Realtid: ny logg → invalidera
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile-views-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profile_views', filter: `viewed_user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ['profile-view-stats', userId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  return {
    stats: query.data ?? DEFAULT,
    isLoading: query.isLoading,
  };
}
