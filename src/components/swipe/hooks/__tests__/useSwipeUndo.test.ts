import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipeUndo } from '../useSwipeUndo';

vi.mock('@/lib/haptics', () => ({
  hapticSuccess: vi.fn(),
}));

describe('useSwipeUndo', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('startar med canUndo=false och tom stack', () => {
    const { result } = renderHook(() => useSwipeUndo({ onUndoSwipeAction: vi.fn() }));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoEntryJobId).toBeNull();
    expect(result.current.consumePendingUndo()).toBeNull();
  });

  it('pushSkipped aktiverar canUndo', () => {
    const { result } = renderHook(() => useSwipeUndo({ onUndoSwipeAction: vi.fn() }));
    act(() => { result.current.pushSkipped('job-1'); });
    expect(result.current.canUndo).toBe(true);
  });

  it('canUndo förblir false utan onUndoSwipeAction även efter push', () => {
    const { result } = renderHook(() => useSwipeUndo({}));
    act(() => { result.current.pushSkipped('job-1'); });
    expect(result.current.canUndo).toBe(false);
  });

  it('handleUndo poppar LIFO och anropar callback med senaste id', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useSwipeUndo({ onUndoSwipeAction: cb }));
    act(() => {
      result.current.pushSkipped('a');
      result.current.pushSkipped('b');
      result.current.pushSkipped('c');
    });
    act(() => { result.current.handleUndo(); });
    expect(cb).toHaveBeenCalledWith('c');
    expect(result.current.canUndo).toBe(true);
    act(() => { result.current.handleUndo(); });
    expect(cb).toHaveBeenLastCalledWith('b');
    act(() => { result.current.handleUndo(); });
    expect(cb).toHaveBeenLastCalledWith('a');
    expect(result.current.canUndo).toBe(false);
  });

  it('handleUndo är no-op på tom stack', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useSwipeUndo({ onUndoSwipeAction: cb }));
    act(() => { result.current.handleUndo(); });
    expect(cb).not.toHaveBeenCalled();
  });

  it('undoEntryJobId sätts vid undo och rensas efter 700ms', () => {
    const { result } = renderHook(() => useSwipeUndo({ onUndoSwipeAction: vi.fn() }));
    act(() => { result.current.pushSkipped('job-x'); });
    act(() => { result.current.handleUndo(); });
    expect(result.current.undoEntryJobId).toBe('job-x');
    act(() => { vi.advanceTimersByTime(699); });
    expect(result.current.undoEntryJobId).toBe('job-x');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.undoEntryJobId).toBeNull();
  });

  it('consumePendingUndo returnerar id en gång och nollställer sedan', () => {
    const { result } = renderHook(() => useSwipeUndo({ onUndoSwipeAction: vi.fn() }));
    act(() => { result.current.pushSkipped('job-y'); });
    act(() => { result.current.handleUndo(); });
    expect(result.current.consumePendingUndo()).toBe('job-y');
    expect(result.current.consumePendingUndo()).toBeNull();
  });

  it('städar timer på unmount utan att sätta state', () => {
    const { result, unmount } = renderHook(() => useSwipeUndo({ onUndoSwipeAction: vi.fn() }));
    act(() => { result.current.pushSkipped('job-z'); });
    act(() => { result.current.handleUndo(); });
    unmount();
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });
});
