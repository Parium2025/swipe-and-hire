import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseJobViewTrackerOptions {
  jobId: string | undefined;
  userId: string | undefined;
  /** Element to observe for scroll completion */
  contentRef: React.RefObject<HTMLElement>;
  /** Threshold for considering content "read" (0-1, default 0.8 = 80% scrolled) */
  scrollThreshold?: number;
  /** Minimum time on page before counting view (ms, default 3000) */
  minTimeOnPage?: number;
}

/**
 * Hook to track job views - only counts once per user per job
 * and only after user has scrolled through most of the content.
 */
export function useJobViewTracker({
  jobId,
  userId,
  contentRef,
  scrollThreshold = 0.8,
  minTimeOnPage = 3000,
}: UseJobViewTrackerOptions) {
  const hasRecordedView = useRef(false);
  const hasReachedScrollThreshold = useRef(false);
  const pageLoadTime = useRef(Date.now());
  const isRecording = useRef(false);

  const recordView = useCallback(async () => {
    // Prevent duplicate calls
    if (
      hasRecordedView.current ||
      isRecording.current ||
      !jobId ||
      !userId
    ) {
      return;
    }

    // Check minimum time on page
    const timeSpent = Date.now() - pageLoadTime.current;
    if (timeSpent < minTimeOnPage) {
      return;
    }

    // Check scroll threshold
    if (!hasReachedScrollThreshold.current) {
      return;
    }

    isRecording.current = true;

    try {
      // Call the database function that handles deduplication
      const { data, error } = await supabase.rpc('record_job_view', {
        p_job_id: jobId,
        p_user_id: userId,
      });

      if (error) {
        console.error('Error recording job view:', error);
        isRecording.current = false;
        return;
      }

      // If function returned true, view was recorded
      if (data === true) {
        console.log('Job view recorded successfully');
      }
      
      hasRecordedView.current = true;
    } catch (err) {
      console.error('Failed to record job view:', err);
      isRecording.current = false;
    }
  }, [jobId, userId, minTimeOnPage]);

  // Check scroll position
  const checkScrollPosition = useCallback(() => {
    const element = contentRef.current;
    if (!element || hasReachedScrollThreshold.current) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    
    // For short content that doesn't scroll, consider it "read" immediately
    if (scrollHeight <= clientHeight) {
      hasReachedScrollThreshold.current = true;
      recordView();
      return;
    }

    // Calculate scroll progress
    const scrollProgress = (scrollTop + clientHeight) / scrollHeight;
    
    if (scrollProgress >= scrollThreshold) {
      hasReachedScrollThreshold.current = true;
      recordView();
    }
  }, [contentRef, scrollThreshold, recordView]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element || !jobId || !userId) return;

    // Reset state on mount
    hasRecordedView.current = false;
    hasReachedScrollThreshold.current = false;
    isRecording.current = false;
    pageLoadTime.current = Date.now();

    // Check initial scroll position (for short content)
    const initialCheck = setTimeout(() => {
      checkScrollPosition();
    }, 500);

    // Add scroll listener
    element.addEventListener('scroll', checkScrollPosition, { passive: true });

    // Also check on a timer for content that fits without scrolling
    const timeCheck = setInterval(() => {
      if (!hasRecordedView.current) {
        checkScrollPosition();
      }
    }, 1000);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(timeCheck);
      element.removeEventListener('scroll', checkScrollPosition);
    };
  }, [jobId, userId, contentRef, checkScrollPosition]);

  return { hasRecordedView: hasRecordedView.current };
}
