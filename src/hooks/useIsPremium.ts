import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Single source of truth för Premium-status i frontend.
 * Använder databas-funktionen has_premium() så samma regel gäller
 * överallt (is_premium = true ELLER premium_until > now()).
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
      const { data, error } = await supabase
        .from('profiles')
        .select('is_premium, premium_until')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) return false;
      if (!data) return false;
      if (data.is_premium === true) return true;
      if (data.premium_until && new Date(data.premium_until as string) > new Date()) return true;
      return false;
    },
  });

  return {
    isPremium: query.data ?? false,
    isLoading: query.isLoading,
  };
}
