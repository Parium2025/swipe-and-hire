import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hover/touchstart-baserad route-prefetch för sidebar-länkar.
 *
 * När användaren håller pekaren över (eller börjar trycka på) en menyknapp
 * börjar vi varma upp datan för den sidan. Eftersom React Query har
 * `staleTime: Infinity` globalt återanvänds resultatet direkt när användaren
 * faktiskt navigerar — sidans skeleton/spinner hinner aldrig visas.
 *
 * Säkerhet: vi prefetchar bara LÄSDATA via befintliga query-nycklar.
 * Ingen mutation, ingen UI-påverkan om prefetchen misslyckas.
 */
export function useSidebarRoutePrefetch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetchRoute = useCallback((url: string) => {
    if (!user) return;

    const key = `${user.id}::${url}`;
    if (prefetchedRef.current.has(key)) return;
    prefetchedRef.current.add(key);

    // Match URL → matching query key + lightweight fetcher.
    // Dessa speglar nycklarna som verkliga sidorna använder, så att
    // resultatet återanvänds 1:1 när sidan monteras.
    switch (url) {
      case '/saved-jobs': {
        queryClient.prefetchQuery({
          queryKey: ['saved-jobs', user.id],
          queryFn: async () => {
            const { data } = await supabase
              .from('saved_jobs')
              .select('id, job_id, created_at, job_postings(*)')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });
            return data ?? [];
          },
          staleTime: 60_000,
        }).catch(() => {
          prefetchedRef.current.delete(key);
        });
        break;
      }
      case '/my-applications': {
        queryClient.prefetchQuery({
          queryKey: ['my-applications', user.id],
          queryFn: async () => {
            const { data } = await supabase
              .from('job_applications')
              .select('*, job_postings(*)')
              .eq('applicant_id', user.id)
              .order('applied_at', { ascending: false });
            return data ?? [];
          },
          staleTime: 60_000,
        }).catch(() => {
          prefetchedRef.current.delete(key);
        });
        break;
      }
      case '/search-jobs': {
        // Sökresultat hämtas via egen hook med filter, men vi kan varma
        // upp grundlistan av aktiva jobb.
        queryClient.prefetchQuery({
          queryKey: ['active-jobs-count'],
          queryFn: async () => {
            const { count } = await supabase
              .from('job_postings')
              .select('id', { count: 'exact', head: true })
              .eq('is_active', true);
            return count ?? 0;
          },
          staleTime: 60_000,
        }).catch(() => {
          prefetchedRef.current.delete(key);
        });
        break;
      }
      // För /home, /messages, /profile m.fl. har vi redan
      // background-sync hooks (useJobSeekerBackgroundSync /
      // useEmployerBackgroundSync) som håller datan färsk — ingen
      // extra prefetch behövs här.
      default:
        break;
    }
  }, [queryClient, user]);

  return prefetchRoute;
}
