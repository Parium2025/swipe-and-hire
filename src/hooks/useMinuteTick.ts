import { useEffect, useRef, useState } from 'react';

/**
 * Returns a value that changes on every full minute, so components rendering
 * relative times ("Om 12 min") stay accurate without a manual refetch.
 * Pauses while the tab is hidden and resyncs immediately when it becomes visible.
 */
export const useMinuteTick = (enabled = true): number => {
  const [tick, setTick] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const clearTimers = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    let syncTimeout: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      clearTimers();
      if (syncTimeout) clearTimeout(syncTimeout);
      const now = new Date();
      const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      setTick(Date.now());
      syncTimeout = setTimeout(() => {
        setTick(Date.now());
        intervalRef.current = setInterval(() => setTick(Date.now()), 60_000);
      }, msUntilNextMinute);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else clearTimers();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      clearTimers();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  return tick;
};
