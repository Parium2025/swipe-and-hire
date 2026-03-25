import { useCallback, useEffect, useRef } from 'react';

interface UseCardInteractionPauseOptions {
  setIsPaused: (value: boolean) => void;
  touchResumeDelayMs?: number;
}

export function useCardInteractionPause({
  setIsPaused,
  touchResumeDelayMs = 3000,
}: UseCardInteractionPauseOptions) {
  const resumeTimeoutRef = useRef<number | null>(null);

  const clearResumeTimeout = useCallback(() => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  }, []);

  const pauseNow = useCallback(() => {
    clearResumeTimeout();
    setIsPaused(true);
  }, [clearResumeTimeout, setIsPaused]);

  const resumeNow = useCallback(() => {
    clearResumeTimeout();
    setIsPaused(false);
  }, [clearResumeTimeout, setIsPaused]);

  const resumeWithDelay = useCallback(() => {
    clearResumeTimeout();
    resumeTimeoutRef.current = window.setTimeout(() => {
      setIsPaused(false);
      resumeTimeoutRef.current = null;
    }, touchResumeDelayMs);
  }, [clearResumeTimeout, setIsPaused, touchResumeDelayMs]);

  useEffect(() => {
    return () => clearResumeTimeout();
  }, [clearResumeTimeout]);

  return {
    pauseNow,
    resumeNow,
    resumeWithDelay,
  };
}