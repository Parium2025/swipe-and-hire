import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStableImageSrc } from '../useStableImageSrc';

const pending: Array<{ resolve: () => void; reject: () => void }> = [];
class PendingImage {
  src = '';
  naturalWidth = 32;
  onload = null;
  onerror = null;
  decode() { return new Promise<void>((resolve, reject) => pending.push({ resolve, reject })); }
}
afterEach(() => { vi.unstubAllGlobals(); pending.length = 0; });

describe('stable image decode gate', () => {
  it('does not publish a cold image until decoding completes', async () => {
    vi.stubGlobal('Image', PendingImage);
    const { result } = renderHook(() => useStableImageSrc('first'));
    expect(result.current).toBeNull();
    await act(async () => pending[0]?.resolve());
    expect(result.current).toBe('first');
  });
  it('keeps a working portrait when a replacement fails', async () => {
    vi.stubGlobal('Image', PendingImage);
    const { result, rerender } = renderHook(({ url }) => useStableImageSrc(url), { initialProps: { url: 'first' } });
    await act(async () => pending[0]?.resolve());
    rerender({ url: 'broken' });
    await act(async () => pending[1]?.reject());
    expect(result.current).toBe('first');
  });
  it('discards delayed images from the previous account', async () => {
    vi.stubGlobal('Image', PendingImage);
    const { result, rerender } = renderHook(({ url, scope }) => useStableImageSrc(url, scope), {
      initialProps: { url: 'first', scope: 'a' },
    });
    await act(async () => pending[0]?.resolve());
    rerender({ url: 'second', scope: 'b' });
    expect(result.current).toBeNull();
    await act(async () => pending[1]?.resolve());
    expect(result.current).toBe('second');
  });
});