import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { SearchJob } from '@/hooks/useOptimizedJobSearch';

/**
 * Prefetch job data from search results into React Query cache.
 * When JobView opens, it checks this cache FIRST — if found, renders instantly
 * with zero network requests. The full fetch still runs in background to
 * get any missing fields (profiles, questions, etc.).
 */

const JOB_PREFETCH_KEY = 'job-prefetch';

export function useJobPrefetchCache() {
  const queryClient = useQueryClient();

  /** Seed all search-result jobs into per-job cache entries */
  const seedJobsFromSearch = useCallback((jobs: SearchJob[]) => {
    jobs.forEach(job => {
      queryClient.setQueryData([JOB_PREFETCH_KEY, job.id], job);
    });
  }, [queryClient]);

  /** Read a single prefetched job (returns undefined if not cached) */
  const getPrefetchedJob = useCallback((jobId: string): SearchJob | undefined => {
    return queryClient.getQueryData<SearchJob>([JOB_PREFETCH_KEY, jobId]);
  }, [queryClient]);

  return { seedJobsFromSearch, getPrefetchedJob };
}
