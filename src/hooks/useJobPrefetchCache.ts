import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { SearchJob } from '@/hooks/useOptimizedJobSearch';

/**
 * Prefetch job data from search results into React Query cache.
 * When JobView opens, it checks this cache FIRST — if found, renders instantly
 * with zero network requests. The full fetch still runs in background to
 * get any missing fields (profiles, questions, etc.).
 */

export const JOB_PREFETCH_KEY = 'job-prefetch';

interface PrefetchedJobBrandingUpdates {
  companyName?: string | null;
  companyLogoUrl?: string | null;
}

const applyBrandingUpdates = (job: SearchJob, updates: PrefetchedJobBrandingUpdates): SearchJob => {
  const nextWorkplaceName = typeof updates.companyName === 'string'
    ? updates.companyName.trim() || null
    : (updates.companyName ?? job.workplace_name ?? null);

  return {
    ...job,
    workplace_name: nextWorkplaceName,
    company_name: nextWorkplaceName || job.company_name || 'Okänt företag',
    company_logo_url: updates.companyLogoUrl ?? job.company_logo_url,
  };
};

export function patchPrefetchedJobsByEmployer(
  queryClient: QueryClient,
  employerId: string,
  updates: PrefetchedJobBrandingUpdates,
) {
  const prefetchedQueries = queryClient.getQueryCache().findAll({ queryKey: [JOB_PREFETCH_KEY] });

  prefetchedQueries.forEach(({ queryKey }) => {
    queryClient.setQueryData<SearchJob | undefined>(queryKey, (existingJob) => {
      if (!existingJob || existingJob.employer_id !== employerId) {
        return existingJob;
      }

      return applyBrandingUpdates(existingJob, updates);
    });
  });
}

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
