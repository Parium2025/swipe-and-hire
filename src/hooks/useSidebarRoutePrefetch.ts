import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { fetchSavedJobsForUser } from '@/hooks/useSavedJobsCache';
import { fetchMyApplicationsForUser } from '@/hooks/useMyApplicationsCache';
import { fetchCandidateInterviewsForUser } from '@/hooks/useInterviews';
import { prefetchEmployerJobsFirstPages } from '@/hooks/useJobsData';

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
  const { user, profile } = useAuth();
  const orgId = (profile as any)?.organization_id ?? null;
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
        // 🔒 Skriv aldrig över en lista som sidan redan äger.
        if (queryClient.getQueryData(['saved-jobs', user.id])) break;
        queryClient.prefetchQuery({
          queryKey: ['saved-jobs', user.id],
          queryFn: () => fetchSavedJobsForUser(user.id),
          staleTime: 60_000,
        }).catch(() => {
          prefetchedRef.current.delete(key);
        });
        break;
      }
      case '/my-applications': {
        if (!queryClient.getQueryData(['candidate-interviews', user.id])) {
          queryClient.prefetchQuery({
            queryKey: ['candidate-interviews', user.id],
            queryFn: () => fetchCandidateInterviewsForUser(user.id),
            staleTime: 60_000,
          }).catch(() => { /* sidan hämtar själv */ });
        }
        if (queryClient.getQueryData(['my-applications', user.id])) break;
        queryClient.prefetchQuery({
          queryKey: ['my-applications', user.id],
          queryFn: () => fetchMyApplicationsForUser(user.id),
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
      case '/my-jobs':
      case '/dashboard': {
        // /my-jobs → useJobsData({ scope: 'personal' })
        // /dashboard → useJobsData({ scope: 'organization' })
        // 🔒 SCALE: exakt samma hämtare som sidan själv använder (första sidan
        // per status + registrerat sidläge), och skriven som "behöver
        // valideras" så sidan alltid hämtar om vid montering. Att skriva en
        // trunkerad, statusblind lista här gjorde tidigare att Utgångna/Utkast
        // kunde visa fel innehåll på konton med fler än 200 annonser.
        const scope = url === '/my-jobs' ? 'personal' : 'organization';
        prefetchEmployerJobsFirstPages(queryClient, { scope, orgId, userId: user.id }).catch(() => {
          prefetchedRef.current.delete(key);
        });
        break;
      }
      case '/subscription': {
        if (queryClient.getQueryData(['is-premium', user.id])) break;
        queryClient.prefetchQuery({
          queryKey: ['is-premium', user.id],
          queryFn: async () => {
            // Samma källa som useIsPremium — direktläsning av profiles ger 403.
            const { data, error } = await supabase.rpc('has_premium', { p_user_id: user.id });
            // Kasta i stället för att cacha "false" – annars skulle ett nätfel
            // se ut som ett giltigt "ingen premium" för hela sidan.
            if (error) throw error;
            return data === true;
          },
          staleTime: 60_000,
        }).catch(() => { prefetchedRef.current.delete(key); });
        break;
      }
      case '/billing': {
        if (queryClient.getQueryData(['billing-purchases', user.id])) break;
        queryClient.prefetchQuery({
          queryKey: ['billing-purchases', user.id],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('one_time_purchases')
              .select('id, price_sek, purchased_at, created_at, status, stripe_payment_intent_id')
              .order('created_at', { ascending: false });
            if (error) throw error;
            return data ?? [];
          },
          staleTime: 60_000,
        }).catch(() => { prefetchedRef.current.delete(key); });
        break;
      }
      // /my-candidates och /messages varmhålls redan via
      // useEmployerBackgroundSync + ConversationsProvider, så ingen
      // extra hover-prefetch behövs här.
      // För /home, /messages, /profile m.fl. har vi redan
      // background-sync hooks (useJobSeekerBackgroundSync /
      // useEmployerBackgroundSync) som håller datan färsk — ingen
      // extra prefetch behövs här.
      default:
        break;
    }
  }, [queryClient, user, orgId]);

  return prefetchRoute;
}
