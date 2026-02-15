import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const CACHE_KEY = 'parium_is_org_admin_';

function readCache(userId: string): boolean | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY + userId);
    if (raw === null) return null;
    return JSON.parse(raw).isAdmin === true;
  } catch {
    return null;
  }
}

function writeCache(userId: string, isAdmin: boolean): void {
  try {
    localStorage.setItem(CACHE_KEY + userId, JSON.stringify({ isAdmin, timestamp: Date.now() }));
  } catch { /* storage full */ }
}

/**
 * Hook to check if the current user is an admin of their organization.
 * Uses React Query with Infinity staleTime — the result is cached permanently
 * during the session to avoid redundant RPC calls on every navigation.
 */
export const useIsOrgAdmin = () => {
  const { user } = useAuth();

  const cachedValue = user ? readCache(user.id) : null;

  const { data: isAdmin = cachedValue ?? false, isLoading: queryLoading } = useQuery({
    queryKey: ['is-org-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { data, error } = await supabase.rpc('is_org_admin', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      const result = data === true;
      writeCache(user.id, result);
      return result;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    initialData: () => {
      if (!user?.id) return undefined;
      const cached = readCache(user.id);
      return cached !== null ? cached : undefined;
    },
    initialDataUpdatedAt: () => {
      if (!user?.id) return undefined;
      const cached = readCache(user.id);
      return cached !== null ? Date.now() - 60000 : undefined;
    },
  });

  const loading = queryLoading && cachedValue === null;

  return { isAdmin, loading };
};
