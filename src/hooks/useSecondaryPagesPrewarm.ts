import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { prewarmSupportTickets } from '@/lib/supportPrewarm';
import { prewarmEmployerSettings } from '@/lib/settingsPrewarm';
import {
  getEmployerAnalyticsCacheKey,
  readEmployerAnalyticsCacheEntry,
  writeEmployerAnalyticsCache,
  readPersistedEmployerAnalyticsFilter,
} from '@/components/analytics/employerAnalyticsCache';

/**
 * 🔥 SEKUNDÄRSIDOR — FÖRVÄRMNING
 *
 * De tunga sidorna (kandidater, annonser, chattar) värms redan av
 * `useEmployerWarmupOrchestrator` / `useJobSeekerWarmupOrchestrator`.
 * Den här hooken täcker resten av menyn så att hela appen känns lika lugn:
 *
 *  - Support: ärendelistan cachas innan /support öppnas
 *  - Inställningar (arbetsgivare): team, regler och mallar
 *  - Statistik (arbetsgivare): översikten skrivs till samma localStorage-cache
 *    som sidan redan läser synkront vid montering
 *
 * Allt körs i idle efter första render, är TTL-skyddat och felar tyst.
 * Inga queries ändras — samma nycklar, samma format, rent additivt.
 */
export function useSecondaryPagesPrewarm() {
  const { user, userRole } = useAuth();
  const isEmployer = userRole?.role === 'employer';
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const run = async () => {
      prewarmSupportTickets(userId);

      // ── Ekonomi (Abonnemang + Betalningar) ──
      // Samma query-nycklar som sidorna använder, så vyerna målas direkt
      // vid kallstart i stället för att fejda/hoppa in när datan landar.
      if (!queryClient.getQueryData(['is-premium', userId])) {
        void queryClient.prefetchQuery({
          queryKey: ['is-premium', userId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('profiles')
              .select('is_premium, premium_until')
              .eq('user_id', userId)
              .maybeSingle();
            if (error || !data) return false;
            if (data.is_premium === true) return true;
            return !!data.premium_until && new Date(data.premium_until as string) > new Date();
          },
          staleTime: 60_000,
        }).catch(() => { /* sidan hämtar själv */ });
      }
      if (!queryClient.getQueryData(['billing-purchases', userId])) {
        void queryClient.prefetchQuery({
          queryKey: ['billing-purchases', userId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('one_time_purchases')
              .select('id, price_sek, purchased_at, created_at, status, stripe_payment_intent_id')
              .order('created_at', { ascending: false });
            if (error) throw error;
            return data ?? [];
          },
          staleTime: 60_000,
        }).catch(() => { /* sidan hämtar själv */ });
      }

      if (!isEmployer) return;

      prewarmEmployerSettings(userId);

      // ── Statistik: fyll cachen om den är tom/utgången ──
      // Sidan har tre datakällor (översikt, avancerat, team). Tidigare värmdes
      // bara översikten, så /reports visade fortfarande spinner i de två andra
      // korten vid kallstart. Nu värms alla tre — sekventiellt så vi aldrig
      // konkurrerar med kandidat-/annonsförvärmningen.
      const days = readPersistedEmployerAnalyticsFilter();
      const params: { p_user_id: string; p_days_back?: number } = { p_user_id: userId };
      if (days !== null) params.p_days_back = days;

      const warmAnalytics = async (
        kind: 'overview' | 'advanced' | 'team',
        rpc: string,
      ) => {
        try {
          const key = getEmployerAnalyticsCacheKey(kind, userId, days);
          if (readEmployerAnalyticsCacheEntry(key)) return;
          const { data, error } = await supabase.rpc(rpc as never, params as never);
          if (!error && data) writeEmployerAnalyticsCache(key, data);
        } catch {
          // Tyst — sidan hämtar själv vid behov.
        }
      };

      await warmAnalytics('overview', 'get_employer_analytics_v2');
      await warmAnalytics('advanced', 'get_employer_advanced_analytics');
      await warmAnalytics('team', 'get_employer_team_insights');
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => { void run(); }, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(() => { void run(); }, 600);
    return () => window.clearTimeout(id);
  }, [userId, isEmployer, queryClient]);
}
