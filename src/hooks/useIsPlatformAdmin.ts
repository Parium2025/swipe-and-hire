import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook to check if the current user is a Parium platform admin
 * (the 'admin' role in public.user_roles). Distinct from org-admin.
 * Used to gate owner-only surfaces (e.g. AI usage dashboard).
 */
export const useIsPlatformAdmin = () => {
  const { user } = useAuth();

  const { data: isPlatformAdmin = false, isLoading } = useQuery({
    queryKey: ['is-platform-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc('is_platform_admin', { _user_id: user.id });
      if (error) {
        console.error('is_platform_admin check failed:', error);
        return false;
      }
      return data === true;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return { isPlatformAdmin, loading: isLoading };
};
