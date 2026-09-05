import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarRoutePrefetch } from '@/hooks/useSidebarRoutePrefetch';
import { getIsOnline } from '@/lib/connectivityManager';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { prefetchUnviewedApplicationCounts } from '@/hooks/useUnviewedApplicationCounts';
import { writeApplicantMembershipCache } from '@/lib/applicantMembershipCache';

/**
 * ❄️ KALLSTART — ARBETSGIVARENS ANNONSSIDOR
 *
 * Kandidater, chattar, support, inställningar och statistik värms redan.
 * Kvar var "Mina annonser" och "Företagets annonser": de hämtades först vid
 * hover i sidomenyn, så det allra första besöket efter inloggning visade
 * skelett.
 *
 * Här körs exakt samma prefetch som hover-varianten (samma query-nycklar,
 * samma hämtare, samma spärr mot att skriva över en redan komplett lista) —
 * men vid första lediga lucka direkt efter inloggning, sekventiellt så vi
 * aldrig konkurrerar med kandidatförvärmningen om bandbredd. Timeouten är
 * kort: värmningen ska hinna före ett normalt första tryck i sidomenyn.
 */
const ROUTES = ['/my-jobs', '/dashboard'];
const DELAY_BETWEEN_MS = 400;
const MEMBERSHIP_BATCH_SIZE = 1_000;
const MEMBERSHIP_CACHE_LIMIT = 5_000;

export function useEmployerPagePrewarm() {
  const { user, userRole, profile } = useAuth();
  const queryClient = useQueryClient();
  const prefetchRoute = useSidebarRoutePrefetch();
  const isEmployer = userRole?.role === 'employer';
  const userId = user?.id;
  const orgId = profile?.organization_id || null;

  useEffect(() => {
    if (!userId || !isEmployer || !getIsOnline()) return;

    let cancelled = false;
    const timers: number[] = [];

    const prewarmApplicantMembership = async () => {
      const applicantIds: string[] = [];

      for (let from = 0; from < MEMBERSHIP_CACHE_LIMIT; from += MEMBERSHIP_BATCH_SIZE) {
        const { data, error } = await supabase
          .from('my_candidates')
          .select('applicant_id')
          .eq('recruiter_id', userId)
          .order('id', { ascending: true })
          .range(from, from + MEMBERSHIP_BATCH_SIZE - 1);

        if (error) throw error;
        const page = data ?? [];
        applicantIds.push(...page.map((row) => row.applicant_id));
        if (page.length < MEMBERSHIP_BATCH_SIZE) break;
      }

      if (!cancelled) writeApplicantMembershipCache(userId, applicantIds);
    };

    // Starta direkt när arbetsgivarrollen är klar. Detta är den lilla datamängd
    // som styr plus/bock på kandidatkort och får inte vänta på idle eller sidbyte.
    void prewarmApplicantMembership().catch(() => {
      // Den synliga kandidatsidan gör samma kontroll för sina rader som fallback.
    });

    const run = () => {
      // "X nya"-siffran på jobbkorten: värm direkt så den aldrig poppar in
      // efter att kortet redan syns.
      void prefetchUnviewedApplicationCounts(queryClient, userId);

      // Antal och statistik har egna query-nycklar och ingår inte i
      // route-prefetchen. Värm båda scopes parallellt så inga siffror poppar in
      // först när Mina/Företagets annonser öppnas.
      for (const scope of ['personal', 'organization'] as const) {
        void queryClient.prefetchQuery({
          queryKey: ['employer-jobs-counts', scope, orgId, userId],
          queryFn: async () => {
            const { data, error } = await supabase.rpc('get_employer_jobs_counts', { p_scope: scope });
            if (error) throw error;
            return data;
          },
          staleTime: 30_000,
        });
        void queryClient.prefetchQuery({
          queryKey: ['employer-dashboard-stats', scope, orgId, userId],
          queryFn: async () => {
            const { data, error } = await supabase.rpc('get_employer_dashboard_stats', { p_scope: scope });
            if (error) throw error;
            return data;
          },
          staleTime: 30_000,
        });
      }

      ROUTES.forEach((url, i) => {
        const t = window.setTimeout(() => {
          if (cancelled) return;
          prefetchRoute(url);
        }, i * DELAY_BETWEEN_MS);
        timers.push(t);
      });
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => run(), { timeout: 500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
        timers.forEach((t) => window.clearTimeout(t));
      };
    }

    const id = window.setTimeout(run, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [userId, isEmployer, orgId, prefetchRoute, queryClient]);
}
