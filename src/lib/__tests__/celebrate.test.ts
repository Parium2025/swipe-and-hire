import { afterEach, describe, expect, it, vi } from 'vitest';

const { fire, create } = vi.hoisted(() => {
  const fire = vi.fn();
  return { fire, create: vi.fn(() => fire) };
});
vi.mock('canvas-confetti', () => ({ default: { create } }));

describe('publication celebration', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.querySelectorAll('[data-parium-confetti]').forEach(canvas => canvas.remove());
  });

  it('fires the same two rounds for successive celebrations and suppresses duplicate calls', async () => {
    vi.resetModules();
    fire.mockClear();
    create.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:21:00Z'));
    vi.stubGlobal('requestIdleCallback', vi.fn());
    const { celebrate } = await import('../celebrate');
    for (let publication = 0; publication < 4; publication++) {
      fire.mockClear();
      await celebrate();
      expect(fire).toHaveBeenCalledTimes(2);
      await celebrate();
      expect(fire).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(519);
      expect(fire).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(fire).toHaveBeenCalledTimes(4);
      await vi.advanceTimersByTimeAsync(1500);
    }
    expect(create).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});