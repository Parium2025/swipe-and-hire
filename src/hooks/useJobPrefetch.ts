import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { prefetchJobDetails } from '@/hooks/useJobDetailsData';

/**
 * Hook to preload job details when hovering over a job row.
 * Uses a debounce to avoid excessive prefetching on quick mouse movements.
 */
export function useJobPrefetch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetchNow = useCallback((jobId: string, seed?: unknown) => {
    if (!user) return;
    if (seed !== undefined) {
      queryClient.setQueryData(['job-details', jobId], (current: unknown) => current ?? seed);
    }
    if (prefetchedRef.current.has(jobId)) return;
    prefetchJobDetails(jobId, user.id, queryClient);
    prefetchedRef.current.add(jobId);
  }, [user, queryClient]);

  const handleMouseEnter = useCallback((jobId: string) => {
    if (!user || prefetchedRef.current.has(jobId)) return;

    // Debounce: only prefetch if hover persists for 100ms
    timeoutRef.current = setTimeout(() => {
      prefetchNow(jobId);
    }, 100);
  }, [user, prefetchNow]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return { handleMouseEnter, handleMouseLeave, prefetchNow };
}
