import { useCallback, useEffect, useRef } from 'react';

interface UseCardInteractionPauseOptions {
  setIsPaused: (value: boolean) => void;
  touchResumeDelayMs?: number;
  /** Home dold (KeepAlive) → avbryt väntande timers. Data lämnas orörd. */
  active?: boolean;
  /** Safety cap: auto-resume after this many ms even if no touchEnd/Cancel fired */
  maxPauseMs?: number;
}

export function useCardInteractionPause({
  setIsPaused,
  touchResumeDelayMs = 3000,
  maxPauseMs = 8000,
  active = true,
}: UseCardInteractionPauseOptions) {
  const resumeTimeoutRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

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
    if (!activeRef.current) return;
    clearResumeTimeout();
    clearSafetyTimeout();
    setIsPaused(true);
    // Failsafe: if nothing resumes within maxPauseMs, auto-resume
    safetyTimeoutRef.current = window.setTimeout(() => {
      if (!activeRef.current) return;
      setIsPaused(false);
      safetyTimeoutRef.current = null;
    }, maxPauseMs);
  }, [clearResumeTimeout, clearSafetyTimeout, setIsPaused, maxPauseMs]);

  const resumeNow = useCallback(() => {
    if (!activeRef.current) return;
    clearResumeTimeout();
    clearSafetyTimeout();
    setIsPaused(false);
  }, [clearResumeTimeout, clearSafetyTimeout, setIsPaused]);

  const resumeWithDelay = useCallback(() => {
    if (!activeRef.current) return;
    clearResumeTimeout();
    clearSafetyTimeout();
    resumeTimeoutRef.current = window.setTimeout(() => {
      if (!activeRef.current) return;
      setIsPaused(false);
      resumeTimeoutRef.current = null;
    }, touchResumeDelayMs);
  }, [clearResumeTimeout, clearSafetyTimeout, setIsPaused, touchResumeDelayMs]);

  useEffect(() => {
    if (!active) {
      // Inaktivering: rensa timers OCH normalisera pausläget direkt —
      // annars kan rotationen vara avstängd för alltid vid återaktivering.
      clearResumeTimeout();
      clearSafetyTimeout();
      setIsPaused(false);
    }
  }, [active, clearResumeTimeout, clearSafetyTimeout, setIsPaused]);

  useEffect(() => {
    return () => { clearResumeTimeout(); clearSafetyTimeout(); };
  }, [clearResumeTimeout, clearSafetyTimeout]);

  return {
    pauseNow,
    resumeNow,
    resumeWithDelay,
  };
}