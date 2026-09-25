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

  it('flyttar ett fokuserat fält högst en gång när tangentbordets mått varierar', async () => {
    const viewport = new VisualViewportMock();
    vi.stubGlobal('visualViewport', viewport);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800);
    vi.stubGlobal('innerHeight', 800);
    const parent = document.createElement('div');
    parent.style.overflowY = 'auto';
    Object.defineProperties(parent, {
      scrollHeight: { value: 1200 },
      clientHeight: { value: 600 },
    });
    const field = document.createElement('textarea');
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue({ top: 470, bottom: 590 } as DOMRect);
    const scrollBy = vi.spyOn(parent, 'scrollBy').mockImplementation(() => {});
    parent.append(field);
    document.body.append(parent);
    field.focus();
    const { unmount } = renderHook(() => useVisualViewportBounds());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
    expect(scrollBy).toHaveBeenCalledTimes(1);
    act(() => {
      viewport.height = 495;
      viewport.dispatchEvent(new Event('resize'));
      viewport.offsetTop = 5;
      viewport.dispatchEvent(new Event('scroll'));
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
    expect(scrollBy).toHaveBeenCalledTimes(1);
    unmount();
    parent.remove();
  });
});