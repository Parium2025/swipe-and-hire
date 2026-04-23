import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const CACHE_KEY = 'parium_is_org_admin_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CachedEntry = { isAdmin: boolean; timestamp: number };

function readCache(userId: string): CachedEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY + userId);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.isAdmin !== 'boolean' || typeof parsed?.timestamp !== 'number') {
      return null;
    }
    return parsed as CachedEntry;
  } catch {
    return null;
  }
}

function writeCache(userId: string, isAdmin: boolean): void {
  try {
    localStorage.setItem(CACHE_KEY + userId, JSON.stringify({ isAdmin, timestamp: Date.now() }));
  } catch { /* storage full */ }
}

function isFresh(entry: CachedEntry | null): boolean {
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Hook to check if the current user is an admin of their organization.
 * Cache is valid for 5 minutes; after that we always re-fetch fresh from the server.
 * A negative cached value (isAdmin=false) is treated as stale on mount so newly granted
 * admin rights show up without manual cache clearing.
 */
export const useIsOrgAdmin = () => {
  const { user } = useAuth();

  const cached = user ? readCache(user.id) : null;
  // Only trust a fresh positive cache as initial value to avoid showing the menu
  // to non-admins from stale data, and to ensure newly-granted admins see it on next load.
  const trustedInitial = cached && isFresh(cached) && cached.isAdmin ? true : undefined;

  const { data: isAdmin = false, isLoading: queryLoading } = useQuery({
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
    staleTime: CACHE_TTL_MS,
    gcTime: CACHE_TTL_MS,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    initialData: trustedInitial,
  });

  const loading = queryLoading && trustedInitial === undefined;

  return { isAdmin, loading };
};
