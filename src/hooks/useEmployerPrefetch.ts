import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Prefetches employer data (templates, company profile, reviews)
 * so pages like /reviews and "Skapa ny annons" load instantly.
 *
 * 🔁 KONSOLIDERING (steg 3):
 *  - Tidigare: 3 separata useEffect:s som alla triggade på samma [user]
 *    dependency → 3 reconciler-pass + 3 parallella queries vid mount.
 *  - Nu: 1 useEffect, körs i idle-callback (efter första render),
 *    hoppar över queries som redan finns färska i cachen.
 *
 * Säkerhet: Samma query-keys som tidigare → komponenter märker noll skillnad.
 */
export function useEmployerPrefetch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const userId = user.id;

    const run = async () => {
      // ── Templates (för "Skapa ny annons"-dialog) ──
      const templatesKey = ['job-templates', userId];
      if (!queryClient.getQueryData(templatesKey)) {
        try {
          const { data } = await supabase
            .from('job_templates')
            .select('*')
            .eq('employer_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });
          if (data) queryClient.setQueryData(templatesKey, data);
        } catch (error) {
          console.error('Failed to prefetch templates:', error);
        }
      }

      // ── Company profile (för /reviews) ──
      queryClient.prefetchQuery({
        queryKey: ['company-profile', userId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          if (error) throw error;
          return data;
        },
        staleTime: 60_000,
      }).catch(() => {});

      // ── Company reviews (för /reviews) ──
      queryClient.prefetchQuery({
        queryKey: ['company-reviews', userId],
        queryFn: async () => {
          const { data: reviews, error } = await supabase
            .from('company_reviews')
            .select('*')
            .eq('company_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          if (!reviews || reviews.length === 0) return [];

          const userIds = reviews
            .filter(r => !r.is_anonymous)
            .map(r => r.user_id);

          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('user_id, first_name, last_name')
              .in('user_id', userIds);

            if (profiles) {
              const profileMap = new Map(profiles.map(p => [p.user_id, p]));
              return reviews.map(r => ({
                ...r,
                profiles: profileMap.get(r.user_id) || undefined,
              }));
            }
          }

          return reviews;
        },
        staleTime: 60_000,
      }).catch(() => {});
    };

    // Kör i idle så vi aldrig konkurrerar med initial render / sidebar-animation
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => { run(); }, { timeout: 2000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 250);
    return () => window.clearTimeout(id);
  }, [user, queryClient]);
}
