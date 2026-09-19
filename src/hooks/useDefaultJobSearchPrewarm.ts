import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { measurePerformance } from '@/lib/realtimePerformance';

/**
 * 🚀 SWIPE MODE / SÖK KALLSTART-PREWARM
 *
 * Det enda som gör att Swipe Mode "laddar länge" på mobilen är första
 * search_jobs-anropet efter inloggning. Den här hooken hämtar standardsökningens
 * första sida (samma queryKey som SearchJobs använder utan filter) i bakgrunden
 * direkt efter login — när användaren öppnar Sök jobb / Swipe Mode ligger sidan
 * redan i React Query-cachen och första kortet renderas direkt medan en tyst
 * bakgrunds-refetch håller datan färsk.
 *
 * Rent additivt: rör ingen befintlig söklogik, UI eller cache.
 * Körs i idle, tyst fail, max en gång per session.
 */

const FIRST_PAGE_SIZE = 100; // samma som useOptimizedJobSearch default pageSize

// Måste matcha queryKey:n i useOptimizedJobSearch exakt för standardfiltren:
// fullSearchQuery '', city '', county '', employmentCodes [], category '',
// salaryTarget undefined, salaryMinSearch undefined, employerIds '', createdAfter '',
// sort 'newest'
const DEFAULT_SEARCH_KEY = [
  'optimized-job-search',
  '',
  '',
  '',
  [] as string[],
  '',
  undefined,
  undefined,
  '',
  '',
  'newest',
] as const;

let __prewarmedThisSession = false;

export function useDefaultJobSearchPrewarm() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || userRole?.role !== 'job_seeker') return;
    if (__prewarmedThisSession) return;
    __prewarmedThisSession = true;

    const run = () => {
      // Hoppa över om cachen redan har färsk data (användaren var nyss på sidan)
      const existing = queryClient.getQueryState(DEFAULT_SEARCH_KEY as unknown as readonly unknown[]);
      if (existing?.data && Date.now() - (existing.dataUpdatedAt ?? 0) < 5 * 60 * 1000) return;

      queryClient.prefetchInfiniteQuery({
        queryKey: DEFAULT_SEARCH_KEY as unknown as readonly unknown[],
        initialPageParam: null,
        queryFn: async () => {
          const { data, error } = await measurePerformance('search', () =>
            supabase.rpc('search_jobs', {
              p_search_query: null,
              p_city: null,
              p_county: null,
              p_employment_types: null,
              p_category: null,
              p_salary_min: null,
              p_salary_max: null,
              p_limit: FIRST_PAGE_SIZE,
              p_offset: 0,
              p_cursor_created_at: null,
              p_cursor_id: null,
              p_cursor_rank: null,
              p_cursor_views: null,
              p_sort: 'newest',
              p_employer_ids: null,
              p_created_after: null,
            } as any),
          );
          if (error) throw error;
          return (data || []) as unknown[];
        },
        getNextPageParam: (lastPage: unknown) => {
          const page = lastPage as any[];
          if (!page || page.length < FIRST_PAGE_SIZE) return undefined;
          const last = page[page.length - 1];
          if (!last?.created_at || !last?.id) return undefined;
          return {
            createdAt: last.created_at,
            id: last.id,
            rank: typeof last.search_rank === 'number' ? last.search_rank : 0,
            views: typeof last.views_count === 'number' ? last.views_count : 0,
          };
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
      }).catch(() => {
        // Tyst fail — söksidan hämtar som vanligt om prewarm misslyckas
      });
    };

    // Kör i idle så inloggningens kritiska render aldrig konkurrerar om nätverket
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(run, { timeout: 2000 });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
  }, [user, userRole?.role, queryClient]);
}
