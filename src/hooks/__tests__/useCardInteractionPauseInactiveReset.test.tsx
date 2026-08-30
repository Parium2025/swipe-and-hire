/**
 * RED: useCardInteractionPause rensar timers vid active=false men lämnar
 * isPaused=true om pausen skedde innan navigeringen. Vid återaktivering kan
 * karusellens rotation då vara avstängd för alltid.
 *
 * Krav:
 * 1) active=true → pauseNow() → active=false normaliserar pausläget till
 *    false exakt en gång.
 * 2) Efter återaktivering kan exakt en normal cadence schemaläggas
 *    (resumeWithDelay schemalägger exakt en resume-timer).
 * 3) Callbacks som anropas medan active=false får inte pausa eller
 *    schemalägga nya timers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, act } from '@testing-library/react';
import { useCardInteractionPause } from '@/hooks/useCardInteractionPause';

interface HarnessHandle {
  pauseNow: () => void;
  resumeNow: () => void;
  resumeWithDelay: () => void;
  isPaused: () => boolean;
}

function Harness({ active, handle }: { active: boolean; handle: React.MutableRefObject<HarnessHandle | null> }) {
  const [isPaused, setIsPaused] = useState(false);
  const api = useCardInteractionPause({ setIsPaused, active, touchResumeDelayMs: 3000, maxPauseMs: 8000 });
  handle.current = { ...api, isPaused: () => isPaused };
  return null;
}

describe('useCardInteractionPause: pausläge normaliseras vid inaktivering', () => {
  const handle: React.MutableRefObject<HarnessHandle | null> = { current: null };

  beforeEach(() => {
    vi.useFakeTimers();
    handle.current = null;
  });

  afterEach(() => { vi.useRealTimers(); });

  it('pauseNow före active=false normaliseras till false exakt en gång', () => {
    const { rerender } = render(<Harness active={true} handle={handle} />);
    act(() => { handle.current!.pauseNow(); });
    expect(handle.current!.isPaused()).toBe(true);

    act(() => { rerender(<Harness active={false} handle={handle} />); });
    expect(handle.current!.isPaused()).toBe(false);

    // Inga kvardröjande timers får flippa läget igen
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(handle.current!.isPaused()).toBe(false);
  });

  it('återaktivering schemalägger exakt en normal resume-cadence', () => {
    const { rerender } = render(<Harness active={true} handle={handle} />);
    act(() => { handle.current!.pauseNow(); });
    act(() => { rerender(<Harness active={false} handle={handle} />); });

    const timeoutSpy = vi.spyOn(window, 'setTimeout');
    act(() => { rerender(<Harness active={true} handle={handle} />); });
    act(() => { handle.current!.resumeWithDelay(); });
    const scheduled = timeoutSpy.mock.calls.length;
    expect(scheduled).toBe(1);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(handle.current!.isPaused()).toBe(false);
    timeoutSpy.mockRestore();
  });

  it('callbacks efter inaktivering kan inte pausa eller schemalägga timers', () => {
    const { rerender } = render(<Harness active={true} handle={handle} />);
    const stale = handle.current!;
    act(() => { rerender(<Harness active={false} handle={handle} />); });

    const timeoutSpy = vi.spyOn(window, 'setTimeout');
    act(() => { stale.pauseNow(); });
    act(() => { stale.resumeWithDelay(); });
    expect(handle.current!.isPaused()).toBe(false);
    expect(timeoutSpy).not.toHaveBeenCalled();
    timeoutSpy.mockRestore();
  });
});
