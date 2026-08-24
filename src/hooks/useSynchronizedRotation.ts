import { useEffect } from 'react';

interface UseSynchronizedRotationParams {
  enabled: boolean;
  intervalMs: number;
  offsetMs?: number;
  onTick: () => void;
}

/**
 * Aligns rotations to a shared wall-clock cadence so multiple carousels stay in sync.
 * Pauses while the tab is hidden (no queued animations / wasted work) and
 * re-aligns to the shared beat as soon as it becomes visible again.
 */
export const useSynchronizedRotation = ({
  enabled,
  intervalMs,
  offsetMs = 0,
  onTick,
}: UseSynchronizedRotationParams) => {
  useEffect(() => {
    if (!enabled) return;

    let timeoutId: number | undefined;
    let intervalId: number | undefined;

    const clearTimers = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const start = () => {
      clearTimers();
      const normalizedOffset = ((offsetMs % intervalMs) + intervalMs) % intervalMs;
      const now = Date.now();
      const phase = ((now - normalizedOffset) % intervalMs + intervalMs) % intervalMs;
      const waitMs = phase === 0 ? intervalMs : intervalMs - phase;

      timeoutId = window.setTimeout(() => {
        timeoutId = undefined;
        onTick();
        intervalId = window.setInterval(onTick, intervalMs);
      }, waitMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else clearTimers();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimers();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, intervalMs, offsetMs, onTick]);
};
