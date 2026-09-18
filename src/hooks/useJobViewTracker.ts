import { useEffect, useRef, useCallback } from 'react';
import { recordJobView } from '@/lib/recordJobView';

interface UseJobViewTrackerOptions {
  jobId: string | undefined;
  userId: string | undefined;
  /** Element to observe for scroll completion */
  contentRef: React.RefObject<HTMLElement>;
  /** Threshold for considering content "read" (0-1, default 0.5 = 50% scrolled) */
  scrollThreshold?: number;
  /** Minimum time on page before counting view (ms, default 2000) */
  minTimeOnPage?: number;
}

/**
 * Hook to track job views - only counts once per user per job
 * and only after user has scrolled through some of the content.
 * The DB function handles deduplication, so double-calls are safe.
 */
export function useJobViewTracker({
  jobId,
  userId,
  contentRef,
  scrollThreshold = 0.5,
  minTimeOnPage = 2000,
}: UseJobViewTrackerOptions) {
  const hasRecordedView = useRef(false);
  const hasReachedScrollThreshold = useRef(false);
  const pageLoadTime = useRef(Date.now());

  const tryRecord = useCallback(async () => {
    if (hasRecordedView.current || !jobId || !userId) return;
    const timeSpent = Date.now() - pageLoadTime.current;
    if (timeSpent < minTimeOnPage || !hasReachedScrollThreshold.current) return;

    hasRecordedView.current = true;
    await recordJobView(jobId, userId);
  }, [jobId, userId, minTimeOnPage]);

  const checkScrollPosition = useCallback(() => {
    const element = contentRef.current;
    if (!element || hasReachedScrollThreshold.current) return;

    const { scrollTop, scrollHeight, clientHeight } = element;

    // Short content that doesn't scroll → consider "read"
    if (scrollHeight <= clientHeight) {
      hasReachedScrollThreshold.current = true;
      tryRecord();
      return;
    }

    const scrollProgress = (scrollTop + clientHeight) / scrollHeight;
    if (scrollProgress >= scrollThreshold) {
      hasReachedScrollThreshold.current = true;
      tryRecord();
    }
  }, [contentRef, scrollThreshold, tryRecord]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element || !jobId || !userId) return;

    hasRecordedView.current = false;
    hasReachedScrollThreshold.current = false;
    pageLoadTime.current = Date.now();

    const initialCheck = setTimeout(checkScrollPosition, 500);
    element.addEventListener('scroll', checkScrollPosition, { passive: true });

    // Periodic check for short content
    const timeCheck = setInterval(() => {
      if (!hasRecordedView.current) checkScrollPosition();
    }, 1000);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(timeCheck);
      element.removeEventListener('scroll', checkScrollPosition);
    };
  }, [jobId, userId, contentRef, checkScrollPosition]);

  return { hasRecordedView: hasRecordedView.current };
}
