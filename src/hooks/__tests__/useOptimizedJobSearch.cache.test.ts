import { describe, expect, it } from 'vitest';
import { hotSearchCacheKey } from '@/hooks/useOptimizedJobSearch';

describe('useOptimizedJobSearch cache keys', () => {
  it('stores the short-lived result under the prefix realtime invalidates', () => {
    expect(hotSearchCacheKey(['', '', [], 'newest']))
      .toMatch(/^parium_hot_job_search_v1_/);
  });
});