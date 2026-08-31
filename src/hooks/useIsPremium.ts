import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Single source of truth för Premium-status i frontend.
 * Den fullständiga egna profilen hämtas via caller-bound get_my_profile(),
 * aldrig via bred kolumnåtkomst på profiles.
 */
export function useIsPremium() {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['is-premium', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      if (!userId) return false;
      const { data: rows, error } = await supabase.rpc('get_my_profile');
      if (error) return false;
      const profile = Array.isArray(rows) ? rows[0] : null;
      if (!profile || profile.user_id !== userId) return false;
      if (profile.is_premium === true) return true;
      if (profile.premium_until && new Date(profile.premium_until) > new Date()) return true;
      return false;
    },
  });

  return {
    isPremium: query.data ?? false,
    isLoading: query.isLoading,
  };
}
