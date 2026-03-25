import { useEffect } from 'react';

interface UseSynchronizedRotationParams {
  enabled: boolean;
  intervalMs: number;
  offsetMs?: number;
  onTick: () => void;
}

/**
 * Aligns rotations to a shared wall-clock cadence so multiple carousels stay in sync.
 */
export const useSynchronizedRotation = ({
  enabled,
  intervalMs,
  offsetMs = 0,
  onTick,
}: UseSynchronizedRotationParams) => {
  useEffect(() => {
    if (!enabled) return;

    const normalizedOffset = ((offsetMs % intervalMs) + intervalMs) % intervalMs;
    const now = Date.now();
    const phase = ((now - normalizedOffset) % intervalMs + intervalMs) % intervalMs;
    const waitMs = phase === 0 ? intervalMs : intervalMs - phase;

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      onTick();
      intervalId = window.setInterval(onTick, intervalMs);
    }, waitMs);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [enabled, intervalMs, offsetMs, onTick]);
};
