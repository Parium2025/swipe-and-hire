/**
 * Security regression: private signed-media cache must be fully clearable.
 *
 * Signed URLs live in localStorage, module memory and the blob image cache.
 * A logout must drop all three, and a request that was already in flight when
 * the cache was cleared must never repopulate it after it resolves.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  resolveNext: null as ((url: string | null) => void) | null,
  mode: 'immediate' as 'immediate' | 'deferred',
  imageCacheClear: vi.fn(),
}));

vi.mock('@/lib/mediaManager', () => ({
  getMediaUrl: vi.fn(() => {
    if (h.mode === 'deferred') {
      return new Promise<string | null>((resolve) => {
        h.resolveNext = resolve;
      });
    }
    return Promise.resolve('https://signed.example/avatar.png');
  }),
  isKnownMissingMedia: () => false,
  clearMissingMedia: vi.fn(),
}));

vi.mock('@/lib/imageCache', () => ({
  imageCache: {
    getCachedUrl: () => null,
    loadImage: () => Promise.resolve(null),
    clear: h.imageCacheClear,
  },
}));

const imageCacheClear = h.imageCacheClear;


import { prefetchMediaUrl, clearPrivateMediaCache } from '@/hooks/useMediaUrl';

const MEDIA_PREFIX = 'media_url_';
const mediaKeys = () => Object.keys(localStorage).filter((k) => k.startsWith(MEDIA_PREFIX));

describe('clearPrivateMediaCache', () => {
  beforeEach(() => {
    localStorage.clear();
    imageCacheClear.mockClear();
    h.mode = 'immediate';
    h.resolveNext = null;
  });

  it('removes stored signed URLs and clears the blob image cache', async () => {
    await prefetchMediaUrl('avatars/user-a.png', 'profile-image');
    expect(mediaKeys().length).toBeGreaterThan(0);

    clearPrivateMediaCache();

    expect(mediaKeys()).toHaveLength(0);
    expect(imageCacheClear).toHaveBeenCalled();
  });

  it('an in-flight load started before the clear cannot repopulate the cache', async () => {
    h.mode = 'deferred';
    const pending = prefetchMediaUrl('avatars/user-a.png', 'profile-image');

    clearPrivateMediaCache();

    h.resolveNext?.('https://signed.example/leaked.png');
    await pending;

    expect(mediaKeys()).toHaveLength(0);
  });
});
