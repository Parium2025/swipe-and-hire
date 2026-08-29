import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  },
}));

import { clearAllAppCaches } from '@/hooks/useEagerRatingsPreload';
import { LOCATION_CACHE_PREFIX, LEGACY_LOCATION_CACHE_KEY } from '@/lib/weatherApi';

describe('logout cache clearing includes weather location keys', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes every v2 user-scoped location key and the exact legacy key', () => {
    localStorage.setItem(`${LOCATION_CACHE_PREFIX}user-a`, JSON.stringify({ timestamp: Date.now() }));
    localStorage.setItem(`${LOCATION_CACHE_PREFIX}user-b`, JSON.stringify({ timestamp: Date.now() }));
    localStorage.setItem(LEGACY_LOCATION_CACHE_KEY, JSON.stringify({ timestamp: Date.now() }));
    localStorage.setItem('unrelated_key', 'keep-me');

    clearAllAppCaches();

    expect(localStorage.getItem(`${LOCATION_CACHE_PREFIX}user-a`)).toBeNull();
    expect(localStorage.getItem(`${LOCATION_CACHE_PREFIX}user-b`)).toBeNull();
    expect(localStorage.getItem(LEGACY_LOCATION_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('keep-me');
  });
});
