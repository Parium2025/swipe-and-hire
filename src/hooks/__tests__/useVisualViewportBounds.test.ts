import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewportBounds } from '@/hooks/useVisualViewportBounds';

class VisualViewportMock extends EventTarget {
  height = 500;
  offsetTop = 0;
}

describe('useVisualViewportBounds', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--keyboard-occlusion-height');
    delete document.documentElement.dataset.keyboardOpen;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('markerar tangentbordet utan att krympa eller flytta appskalet', () => {
    const viewport = new VisualViewportMock();
    vi.stubGlobal('visualViewport', viewport);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800);
    vi.stubGlobal('innerHeight', 800);

    const { unmount } = renderHook(() => useVisualViewportBounds());

    expect(document.documentElement.dataset.keyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--keyboard-occlusion-height')).toBe('300px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-offset')).toBe('');

    act(() => {
      viewport.height = 800;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(document.documentElement.dataset.keyboardOpen).toBe('false');
    expect(document.documentElement.style.getPropertyValue('--keyboard-occlusion-height')).toBe('0px');

    unmount();
  });
});