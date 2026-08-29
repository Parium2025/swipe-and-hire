/**
 * TDD RED — logout cleanup must remove notes caches.
 *
 * clearAllAppCaches() is the single central logout cleanup. It must remove
 * both the exact legacy `jobseeker_notes_cache` key and every user-scoped
 * `jobseeker_notes_cache_<uid>` key.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));

import { clearAllAppCaches } from '@/hooks/useEagerRatingsPreload';

describe('clearAllAppCaches — notes cache cleanup', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.authTransition = 'false';
    document.body.dataset.authTransition = 'false';
    window.history.pushState({}, '', '/');
  });

  it('removes legacy and all user-scoped notes caches', () => {
    localStorage.setItem('jobseeker_notes_cache', 'LEGACY');
    localStorage.setItem('jobseeker_notes_cache_user-a', 'A');
    localStorage.setItem('jobseeker_notes_cache_user-b', 'B');
    localStorage.setItem('unrelated_key', 'keep');

    clearAllAppCaches();

    expect(localStorage.getItem('jobseeker_notes_cache')).toBeNull();
    expect(localStorage.getItem('jobseeker_notes_cache_user-a')).toBeNull();
    expect(localStorage.getItem('jobseeker_notes_cache_user-b')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('keep');
  });
});
