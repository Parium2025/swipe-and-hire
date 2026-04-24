import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { safeSetItem } from '@/lib/safeStorage';

export interface EmployerJobsCounts {
  active: number;
  expired: number;
  draft: number;
  total: number;
}

export interface EmployerDashboardStats {
  active_jobs: number;
  total_views: number;
  total_applications: number;
}

/**
 * 🔥 SWR-mönster för server-aggregerade siffror.
 * Vi seedar React Query med senast kända värde från localStorage så att
 * Dashboard/MyJobs renderar EXAKT counts direkt (0ms) vid tab-byte och
 * page reload, samtidigt som vi hämtar färska siffror i bakgrunden.
 *
 * Spotify-mönstret: visa cached state direkt, validera tyst.
 */

const COUNTS_CACHE_KEY = 'parium_employer_counts_v1_';
const STATS_CACHE_KEY = 'parium_employer_stats_v1_';

interface CachedEntry<T> {
  scope: string;
  orgId: string | null;
  data: T;
  timestamp: number;
}

function readCache<T>(prefix: string, userId: string, scope: string, orgId: string | null): T | undefined {
  const key = prefix + userId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const cached: CachedEntry<T> = JSON.parse(raw);
    if (!cached || typeof cached !== 'object') {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return undefined;
    }
    if (cached.scope !== scope || cached.orgId !== orgId) return undefined;
    return cached.data;
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return undefined;
  }
}

function writeCache<T>(prefix: string, userId: string, scope: string, orgId: string | null, data: T): void {
  const entry: CachedEntry<T> = { scope, orgId, data, timestamp: Date.now() };
  safeSetItem(prefix + userId, JSON.stringify(entry));
}

/**
 * Server-side counts för aktiva/utgångna/utkast.
 * Använd när orgen kan ha 5–10k+ jobb och klient-side räkning blir för dyr.
 * Returnerar exakta totaler oavsett hur mycket som är laddat lokalt.
 */
export const useEmployerJobsCounts = (scope: 'personal' | 'organization' = 'personal') => {
  const { user, profile } = useAuth();
  const orgId = profile?.organization_id || null;

  return useQuery<EmployerJobsCounts>({
    queryKey: ['employer-jobs-counts', scope, orgId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_employer_jobs_counts', { p_scope: scope });
      if (error) throw error;
      const result = (data as unknown as EmployerJobsCounts) ?? { active: 0, expired: 0, draft: 0, total: 0 };
      if (user) writeCache(COUNTS_CACHE_KEY, user.id, scope, orgId, result);
      return result;
    },
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    // 🔥 SWR-seed: visa senast kända counts direkt utan blink
    placeholderData: () => {
      if (!user) return undefined;
      return readCache<EmployerJobsCounts>(COUNTS_CACHE_KEY, user.id, scope, orgId);
    },
  });
};

/**
 * Server-aggregerad statistik (visningar + ansökningar).
 * Skalar till miljoner ansökningar utan att lasta klienten.
 */
export const useEmployerDashboardStats = (scope: 'personal' | 'organization' = 'personal') => {
  const { user, profile } = useAuth();
  const orgId = profile?.organization_id || null;

  return useQuery<EmployerDashboardStats>({
    queryKey: ['employer-dashboard-stats', scope, orgId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_employer_dashboard_stats', { p_scope: scope });
      if (error) throw error;
      const result = (data as unknown as EmployerDashboardStats) ?? { active_jobs: 0, total_views: 0, total_applications: 0 };
      if (user) writeCache(STATS_CACHE_KEY, user.id, scope, orgId, result);
      return result;
    },
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    // 🔥 SWR-seed: visa senast kända stats direkt utan blink
    placeholderData: () => {
      if (!user) return undefined;
      return readCache<EmployerDashboardStats>(STATS_CACHE_KEY, user.id, scope, orgId);
    },
  });
};
