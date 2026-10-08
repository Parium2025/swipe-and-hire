import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const { fire, create } = vi.hoisted(() => {
  const fire = vi.fn();
  return { fire, create: vi.fn(() => fire) };
});
vi.mock('canvas-confetti', () => ({ default: { create } }));

describe('publication celebration', () => {
  it('uses the same celebration only in successful new application branches', () => {
    const job = readFileSync('src/pages/JobView.tsx', 'utf8');
    const swipe = readFileSync('src/components/swipe/hooks/useApplySubmit.ts', 'utf8');
    for (const source of [job, swipe]) {
      expect(source).toContain("import { celebrate } from '@/lib/celebrate'");
      expect(source.match(/void celebrate\(/g)).toHaveLength(1);
      expect(source.indexOf('void celebrate(')).toBeGreaterThan(source.indexOf('if (error) throw error;'));
      expect(source.slice(source.indexOf("code === '23505'"))).not.toContain('celebrate(');
      expect(source).toContain("celebrate({ intensity: 'big' }).catch(");
    }
  });
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