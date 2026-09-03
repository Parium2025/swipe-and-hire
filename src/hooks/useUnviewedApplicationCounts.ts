import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useAuth } from '@/hooks/useAuth';

/**
 * Antal ansökningar arbetsgivaren INTE har öppnat ännu, per annons.
 *
 * Servern är sanning (`viewed_at IS NULL`) så siffran är identisk i mobil och
 * desktop, och den nollas automatiskt när kandidaten öppnas – då sätts
 * `viewed_at` och realtime-eventet invaliderar den här frågan.
 */
export const UNVIEWED_APPLICATIONS_QUERY_KEY = 'employer-unviewed-applications';

export function useUnviewedApplicationCounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: [UNVIEWED_APPLICATIONS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as { job_id: string; unviewed_count: number }[];
      const { data, error } = await supabase.rpc('get_employer_unviewed_application_counts');
      if (error) throw error;
      return (data ?? []) as { job_id: string; unviewed_count: number }[];
    },
    enabled: !!user?.id,
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
      }, 1000);
    };
    const channel = createRealtimeChannel(`employer-unviewed-apps-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, invalidate)
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
