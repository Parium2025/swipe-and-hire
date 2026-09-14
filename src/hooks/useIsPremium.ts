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
      // ⚠️ is_premium/premium_until är INTE läsbara direkt från profiles —
      // tabellen har kolumnnivå-grants och direktläsning gav 403 för alla
      // användare (premium visades därför aldrig). has_premium() är
      // security definer och kapslar samma regel.
      const { data, error } = await supabase.rpc('has_premium', { p_user_id: userId });
      if (error) return false;
      return data === true;
    },
  });

  return {
    isPremium: query.data ?? false,
    isLoading: query.isLoading,
  };
}
