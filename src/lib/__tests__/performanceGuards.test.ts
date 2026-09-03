import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPersistentCacheByPrefix,
  readPersistentCache,
  readThroughCache,
} from '@/lib/performanceGuards';

describe('performanceGuards', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPersistentCacheByPrefix('test-cache-');
  });

  it('låter inte ett gammalt pågående svar skriva tillbaka efter realtidsrensning', async () => {
    const key = 'test-cache-search';
    let resolveOld: ((value: string[]) => void) | undefined;
    const oldRequest = readThroughCache(
      key,
      20_000,
      () => new Promise<string[]>((resolve) => { resolveOld = resolve; }),
      Array.isArray,
    );

    clearPersistentCacheByPrefix('test-cache-');

    const freshRequest = readThroughCache(
      key,
      20_000,
      async () => ['fresh'],
      Array.isArray,
    );
    await expect(freshRequest).resolves.toEqual(['fresh']);

    resolveOld?.(['stale']);
    await expect(oldRequest).resolves.toEqual(['stale']);

    expect(readPersistentCache(key, 20_000, Array.isArray)).toEqual(['fresh']);
  });
});