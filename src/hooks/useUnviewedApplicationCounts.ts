import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useAuth } from '@/hooks/useAuth';
import { safeSetItem, safeReadArrayCache } from '@/lib/safeStorage';

/**
 * Antal ansökningar arbetsgivaren INTE har öppnat ännu, per annons.
 *
 * Ägarregeln (servern är sanning, identiskt i mobil och desktop):
 * - Egna annonser: personlig markering per teammedlem (job_application_views).
 * - Kollegors annonser: delad markering (job_applications.viewed_at).
 * Realtime på båda tabellerna invaliderar frågan när något ändras.
 */
export const UNVIEWED_APPLICATIONS_QUERY_KEY = 'employer-unviewed-applications';

export interface UnviewedCountRow { job_id: string; unviewed_count: number }

const STORAGE_PREFIX = 'parium_unviewed_apps_v1_';

/** Läser senast kända siffror från förra sessionen (kallstart utan popp). */
export function readPersistedUnviewedCounts(userId: string | undefined): UnviewedCountRow[] | null {
  if (!userId) return null;
  const rows = safeReadArrayCache<UnviewedCountRow>(`${STORAGE_PREFIX}${userId}`, 'items');
  if (!rows) return null;
  return rows.filter((r) => r && typeof r.job_id === 'string');
}

function persistUnviewedCounts(userId: string | undefined, rows: UnviewedCountRow[]) {
  if (!userId) return;
  safeSetItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify({ items: rows, timestamp: Date.now() }));
}

export async function fetchUnviewedApplicationCounts(userId: string): Promise<UnviewedCountRow[]> {
  const { data, error } = await supabase.rpc('get_employer_unviewed_application_counts');
  if (error) throw error;
  const rows = (data ?? []) as UnviewedCountRow[];
  persistUnviewedCounts(userId, rows);
  return rows;
}

/** Förvärmning: fyller cachen innan någon vy som visar siffran monteras. */
export function prefetchUnviewedApplicationCounts(queryClient: QueryClient, userId: string) {
  const persisted = readPersistedUnviewedCounts(userId);
  if (persisted && !queryClient.getQueryData([UNVIEWED_APPLICATIONS_QUERY_KEY, userId])) {
    queryClient.setQueryData([UNVIEWED_APPLICATIONS_QUERY_KEY, userId], persisted);
  }
  return queryClient.prefetchQuery({
    queryKey: [UNVIEWED_APPLICATIONS_QUERY_KEY, userId],
    queryFn: () => fetchUnviewedApplicationCounts(userId),
    staleTime: 30_000,
  });
}

export function useUnviewedApplicationCounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: [UNVIEWED_APPLICATIONS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as UnviewedCountRow[];
      return fetchUnviewedApplicationCounts(user.id);
    },
    enabled: !!user?.id,
    // Kallstart: visa förra sessionens siffror direkt, uppdatera i bakgrunden.
    initialData: () => readPersistedUnviewedCounts(user?.id) ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Realtime + flikbyte håller pricken färsk utan polling.
  useEffect(() => {
    if (!user?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey: [UNVIEWED_APPLICATIONS_QUERY_KEY] });
        // Samma händelse håller startsidans "Nya ansökningar" live utan att
        // öppna en andra realtidskanal per inloggad arbetsgivare.
        queryClient.invalidateQueries({ queryKey: ['employer-inbox-stats'] });
      }, 1000);
    };
    const channel = createRealtimeChannel(`employer-unviewed-apps-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, invalidate)
      // Egna annonser: min egen markering skrivs i job_application_views och
      // uppdaterar inte alltid job_applications — lyssna där också.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_application_views', filter: `viewer_id=eq.${user.id}` },
        invalidate,
      )
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') invalidate(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id, queryClient]);

  const countsByJob = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      if (row?.job_id) map.set(row.job_id, row.unviewed_count ?? 0);
    }
    return map;
  }, [data]);

  const totalUnviewed = useMemo(
    () => Array.from(countsByJob.values()).reduce((sum, n) => sum + n, 0),
    [countsByJob]
  );

  return { countsByJob, totalUnviewed };
}
