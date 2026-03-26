import { useCallback, useEffect, useRef } from 'react';

interface UseCardInteractionPauseOptions {
  setIsPaused: (value: boolean) => void;
  touchResumeDelayMs?: number;
  /** Safety cap: auto-resume after this many ms even if no touchEnd/Cancel fired */
  maxPauseMs?: number;
}

export function useCardInteractionPause({
  setIsPaused,
  touchResumeDelayMs = 3000,
  maxPauseMs = 8000,
}: UseCardInteractionPauseOptions) {
  const resumeTimeoutRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<number | null>(null);

  const clearResumeTimeout = useCallback(() => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  }, []);

  const clearSafetyTimeout = useCallback(() => {
    if (safetyTimeoutRef.current !== null) {
      window.clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, []);

  const pauseNow = useCallback(() => {
    clearResumeTimeout();
    clearSafetyTimeout();
    setIsPaused(true);
    // Failsafe: if nothing resumes within maxPauseMs, auto-resume
    safetyTimeoutRef.current = window.setTimeout(() => {
      setIsPaused(false);
      safetyTimeoutRef.current = null;
    }, maxPauseMs);
  }, [clearResumeTimeout, clearSafetyTimeout, setIsPaused, maxPauseMs]);

  const resumeNow = useCallback(() => {
    clearResumeTimeout();
    clearSafetyTimeout();
    setIsPaused(false);
  }, [clearResumeTimeout, clearSafetyTimeout, setIsPaused]);

  const resumeWithDelay = useCallback(() => {
    clearResumeTimeout();
    clearSafetyTimeout();
    resumeTimeoutRef.current = window.setTimeout(() => {
      setIsPaused(false);
      resumeTimeoutRef.current = null;
    }, touchResumeDelayMs);
  }, [clearResumeTimeout, clearSafetyTimeout, setIsPaused, touchResumeDelayMs]);

  useEffect(() => {
    return () => { clearResumeTimeout(); clearSafetyTimeout(); };
  }, [clearResumeTimeout, clearSafetyTimeout]);

  return {
    pauseNow,
    resumeNow,
    resumeWithDelay,
  };
}