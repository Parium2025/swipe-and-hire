import { useEffect, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProgressivePagination } from '@/hooks/useProgressivePagination';

/**
 * 🪜 JOB SEARCH PROGRESSIVE PAGINATION
 *
 * Trappan för jobbsökarens sökning. Eftersom ['optimized-job-search', ...]
 * har dynamiska filter-keys (stad, kategori, lön, ...) måste vi hitta den
 * AKTIVT mountade queryn och trigga progressive prefetch på den.
 *
 * Strategi:
 *  - Lyssnar på React Query-cachen
 *  - När en ny optimized-job-search-query dyker upp → starta trappan
 *    på exakt den queryKey:n
 *  - Renderkostnad är minimal; allt körs via subscribe + idle prefetch
 *
 * Resultat: när användaren scrollar i SearchJobs har sida 2 (och 3) redan
 * laddats i bakgrunden → ingen vänta på fetchNextPage().
 */
export function useJobSearchProgressivePagination() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const [activeKey, setActiveKey] = useState<QueryKey | null>(null);

  useEffect(() => {
    if (!user) return;
    if (userRole?.role !== 'job_seeker') return;

    let lastKeyStr: string | null = null;

    const pickLatest = () => {
      const queries = queryClient.getQueryCache().findAll({
        queryKey: ['optimized-job-search'],
      });
      let best: { key: QueryKey; updated: number } | null = null;
      for (const q of queries) {
        const updated = q.state.dataUpdatedAt ?? 0;
        if (q.state.data && (!best || updated > best.updated)) {
          best = { key: q.queryKey, updated };
        }
      }
      const newKeyStr = best ? JSON.stringify(best.key) : null;
      if (newKeyStr !== lastKeyStr) {
        lastKeyStr = newKeyStr;
        setActiveKey(best ? best.key : null);
      }
    };

    pickLatest();
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'added' && event.type !== 'updated') return;
      const key = event.query.queryKey;
      if (!Array.isArray(key) || key[0] !== 'optimized-job-search') return;
      pickLatest();
    });

    return () => unsub();
  }, [user, userRole?.role, queryClient]);

  // Kör trappan på aktiv search-query (max 3 sidor — söklistor är längre och
  // användaren scrollar oftast inte hela vägen)
  useProgressivePagination({
    queryKey: activeKey ?? ['__inactive_optimized_job_search__'],
    enabled: !!user && userRole?.role === 'job_seeker' && !!activeKey,
    maxPages: 3,
    delayBetweenPages: 1200,
  });
}
