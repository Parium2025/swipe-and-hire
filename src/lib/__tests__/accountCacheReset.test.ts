/**
 * Security regression: account-scoped cache reset.
 *
 * Manual logout and auth-owner transitions must synchronously drop every
 * account-derived cache key (private interview payloads, signed media URLs,
 * Parium sessionStorage counters) while leaving unrelated keys untouched.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/hooks/useMediaUrl', () => ({
  clearPrivateMediaCache: vi.fn(),
}));

import {
  resetAccountScopedCaches,
  claimAccountCacheOwner,
  getAccountCacheOwner,
  ACCOUNT_CACHE_OWNER_KEY,
} from '@/lib/accountCacheReset';
import { clearPrivateMediaCache } from '@/hooks/useMediaUrl';

const seed = () => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(
    'job_seeker_interviews_user-a',
    JSON.stringify({ interviews: [{ location_details: 'https://meet.example/private' }] })
  );
  localStorage.setItem('media_url_profile-image_avatars/user-a.png', JSON.stringify({ url: 'https://signed', expiresAt: Date.now() + 1000 }));
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('sb-project-auth-token', 'token');
  sessionStorage.setItem('parium_saved_jobs', '7');
  sessionStorage.setItem('parium_avatar_url', 'https://signed/avatar');
  sessionStorage.setItem('unrelated_session_key', 'keep');
};

describe('resetAccountScopedCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seed();
  });

  it('removes private interview, media and Parium session caches but preserves unrelated keys', () => {
    resetAccountScopedCaches(null);

    expect(localStorage.getItem('job_seeker_interviews_user-a')).toBeNull();
    expect(localStorage.getItem('media_url_profile-image_avatars/user-a.png')).toBeNull();
    expect(sessionStorage.getItem('parium_saved_jobs')).toBeNull();
    expect(sessionStorage.getItem('parium_avatar_url')).toBeNull();

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('sb-project-auth-token')).toBe('token');
    expect(sessionStorage.getItem('unrelated_session_key')).toBe('keep');
    expect(clearPrivateMediaCache).toHaveBeenCalledTimes(1);
    expect(getAccountCacheOwner()).toBeNull();
  });

  it('records the next owner when one is supplied', () => {
    resetAccountScopedCaches('user-b');
    expect(sessionStorage.getItem(ACCOUNT_CACHE_OWNER_KEY)).toBe('user-b');
  });

  it('claiming a different owner resets account caches', () => {
    sessionStorage.setItem(ACCOUNT_CACHE_OWNER_KEY, 'user-a');

    claimAccountCacheOwner('user-b');

    expect(sessionStorage.getItem('parium_saved_jobs')).toBeNull();
    expect(localStorage.getItem('job_seeker_interviews_user-a')).toBeNull();
    expect(getAccountCacheOwner()).toBe('user-b');
  });

  it('claiming the same owner preserves warm caches', () => {
    sessionStorage.setItem(ACCOUNT_CACHE_OWNER_KEY, 'user-a');

    claimAccountCacheOwner('user-a');

    expect(sessionStorage.getItem('parium_saved_jobs')).toBe('7');
    expect(localStorage.getItem('job_seeker_interviews_user-a')).not.toBeNull();
    expect(clearPrivateMediaCache).not.toHaveBeenCalled();
  });
});
