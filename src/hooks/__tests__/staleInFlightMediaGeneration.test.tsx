/**
 * Security regression: a signed-URL load that started BEFORE
 * clearPrivateMediaCache() must not hand the previous account's URL to any
 * caller after the clear. It must resolve to null, so no blob warmup
 * (imageCache.loadImage) and no visible URL can be repopulated.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  resolveNext: null as ((url: string | null) => void) | null,
  loadImage: vi.fn(() => Promise.resolve(null as string | null)),
  clear: vi.fn(),
}));

vi.mock('@/lib/mediaManager', () => ({
  getMediaUrl: vi.fn(
    () =>
      new Promise<string | null>((resolve) => {
        h.resolveNext = resolve;
      }),
  ),
  isKnownMissingMedia: () => false,
  clearMissingMedia: vi.fn(),
}));

vi.mock('@/lib/imageCache', () => ({
  imageCache: {
    getCachedUrl: () => null,
    loadImage: h.loadImage,
    clear: h.clear,
    evict: vi.fn(),
    evictByPattern: vi.fn(),
  },
}));

import { prefetchMediaUrl, clearPrivateMediaCache, useMediaUrl } from '@/hooks/useMediaUrl';

const STALE_URL = 'https://signed.example/account-a.png';

describe('stale in-flight signed URL after account switch', () => {
  beforeEach(() => {
    localStorage.clear();
    h.resolveNext = null;
    h.loadImage.mockClear();
    h.clear.mockClear();
  });

  it('prefetch does not warm the blob cache with a stale URL', async () => {
    const pending = prefetchMediaUrl('avatars/user-a.png', 'profile-image');
    await waitFor(() => expect(h.resolveNext).not.toBeNull());

    clearPrivateMediaCache();
    h.loadImage.mockClear();

    h.resolveNext?.(STALE_URL);
    await pending;

    expect(h.loadImage).not.toHaveBeenCalled();
    expect(Object.keys(localStorage).filter((k) => k.startsWith('media_url_'))).toHaveLength(0);
  });

  it('a mounted hook never shows the previous account URL', async () => {
    const { result } = renderHook(() => useMediaUrl('avatars/user-a.png', 'profile-image'));
    await waitFor(() => expect(h.resolveNext).not.toBeNull());

    clearPrivateMediaCache();
    h.loadImage.mockClear();

    h.resolveNext?.(STALE_URL);
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current).not.toBe(STALE_URL);
    expect(h.loadImage).not.toHaveBeenCalledWith(STALE_URL);
  });
});
