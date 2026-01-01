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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prefetchedRef = useRef<Set<string>>(new Set());

  const handleMouseEnter = useCallback((jobId: string) => {
    if (!user || prefetchedRef.current.has(jobId)) return;

    // Debounce: only prefetch if hover persists for 100ms
    timeoutRef.current = setTimeout(() => {
      prefetchJobDetails(jobId, user.id, queryClient);
      prefetchedRef.current.add(jobId);
    }, 100);
  }, [user, queryClient]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return { handleMouseEnter, handleMouseLeave };
}
