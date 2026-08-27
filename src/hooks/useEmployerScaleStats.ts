import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

// v2: nyckeln innehåller scope. I v1 delade 'personal' och 'organization'
// samma nyckel, så den sida du besökte sist skrev över den andras seed —
// resultatet blev en synlig sifferblinkning varje gång du växlade vy.
const COUNTS_CACHE_KEY = 'parium_employer_counts_v2_';
const STATS_CACHE_KEY = 'parium_employer_stats_v2_';

const cacheKey = (prefix: string, userId: string, scope: string) => `${prefix}${scope}_${userId}`;

/** Rensa v1-nycklarna en gång så gamla, scope-blandade värden aldrig visas. */
try {
  for (const legacy of ['parium_employer_counts_v1_', 'parium_employer_stats_v1_']) {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(legacy)) localStorage.removeItem(k);
    }
  }
} catch { /* ignore */ }

interface CachedEntry<T> {
  scope: string;
  orgId: string | null;
  data: T;
  timestamp: number;
}

function readCache<T>(prefix: string, userId: string, scope: string, orgId: string | null): T | undefined {
  const key = cacheKey(prefix, userId, scope);
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
  safeSetItem(cacheKey(prefix, userId, scope), JSON.stringify(entry));
}

/**
 * 🔴 Live-synk för arbetsgivarsiffrorna.
 * En delad kanal (per användare) som lyssnar på annonser, visningar och
 * ansökningar. RLS filtrerar payloads per prenumerant, så vi ser bara
 * händelser vi har rätt till. Invalidering är debouncad så en burst av
 * events bara ger en refetch.
 *
 * Utgångna annonser byter status via tid, inte via ett DB-event — därför
 * kompletterar vi med en tyst refetch var 60:e sekund och vid fönsterfokus.
 */
type LiveListener = () => void;

// En enda delad kanal för hela appen, oavsett hur många komponenter/hooks
// som prenumererar. Ref-räknad så den stängs när sista lyssnaren försvinner.
const liveListeners = new Set<LiveListener>();
let liveChannel: ReturnType<typeof supabase.channel> | null = null;
let liveChannelUserId: string | null = null;

const notifyLiveListeners = () => {
  liveListeners.forEach((listener) => listener());
};

const ensureLiveChannel = (userId: string) => {
  if (liveChannel && liveChannelUserId === userId) return;
  if (liveChannel) {
    supabase.removeChannel(liveChannel);
    liveChannel = null;
  }
  liveChannelUserId = userId;
  liveChannel = supabase
    .channel(`employer-stats-live-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_postings' }, notifyLiveListeners)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, notifyLiveListeners)
    .subscribe();
};

const teardownLiveChannel = () => {
  if (liveListeners.size > 0) return;
  if (liveChannel) supabase.removeChannel(liveChannel);
  liveChannel = null;
  liveChannelUserId = null;
};

const useEmployerStatsLiveSync = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['employer-jobs-counts'] });
        queryClient.invalidateQueries({ queryKey: ['employer-dashboard-stats'] });
      }, 300);
    };

    liveListeners.add(invalidate);
    ensureLiveChannel(userId);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') invalidate();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      liveListeners.delete(invalidate);
      teardownLiveChannel();
    };
  }, [userId, queryClient]);
};

/**
 * Server-side counts för aktiva/utgångna/utkast.
 * Använd när orgen kan ha 5–10k+ jobb och klient-side räkning blir för dyr.
 * Returnerar exakta totaler oavsett hur mycket som är laddat lokalt.
 */
export const useEmployerJobsCounts = (scope: 'personal' | 'organization' = 'personal') => {
  const { user, profile } = useAuth();
  const orgId = profile?.organization_id || null;
  useEmployerStatsLiveSync(user?.id);

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
    // Live: fokus + tyst intervall fångar tidsbaserade statusbyten (utgångna annonser)
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
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
  useEmployerStatsLiveSync(user?.id);

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
    // Live: fokus + tyst intervall fångar tidsbaserade statusbyten (utgångna annonser)
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    // 🔥 SWR-seed: visa senast kända stats direkt utan blink
    placeholderData: () => {
      if (!user) return undefined;
      return readCache<EmployerDashboardStats>(STATS_CACHE_KEY, user.id, scope, orgId);
    },
  });
};
