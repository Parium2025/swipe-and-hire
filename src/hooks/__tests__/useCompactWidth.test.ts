import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCompactWidth } from '@/hooks/useCompactWidth';

describe('useCompactWidth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('behåller senaste giltiga läge när en KeepAlive-nod blir dold', () => {
    let notify: ResizeObserverCallback | undefined;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);

    const node = document.createElement('div');
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
      width: 300,
      height: 44,
      top: 0,
      right: 300,
      bottom: 44,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const { result } = renderHook(() => useCompactWidth(380));
    act(() => result.current.ref(node));
    expect(result.current.compact).toBe(true);

    act(() => notify?.([{ contentRect: { width: 0 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(result.current.compact).toBe(true);

    act(() => notify?.([{ contentRect: { width: 500 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(result.current.compact).toBe(false);
  });
});