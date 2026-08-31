import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStorageAdapter, clearInactivityLogoutFromStorage } from '@/lib/authStorage';

const LAST_ACTIVITY_KEY = 'parium-last-activity';
const AUTH_KEY = 'sb-example-auth-token';

describe('AuthStorageAdapter human-activity boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearInactivityLogoutFromStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not turn a background auth-token write into human activity', () => {
    const lastHumanActivity = String(Date.now() - 60 * 60 * 1000);
    localStorage.setItem(LAST_ACTIVITY_KEY, lastHumanActivity);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, lastHumanActivity);

    new AuthStorageAdapter().setItem(AUTH_KEY, JSON.stringify({
      access_token: 'refreshed-token',
      user: { id: 'user-1' },
    }));

    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(lastHumanActivity);
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBe(lastHumanActivity);
  });

  it('keeps an expired activity marker until credential logout is confirmed', async () => {
    vi.useFakeTimers();
    const expiredActivity = String(Date.now() - 25 * 60 * 60 * 1000);
    localStorage.setItem(LAST_ACTIVITY_KEY, expiredActivity);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, expiredActivity);
    sessionStorage.setItem(AUTH_KEY, JSON.stringify({
      access_token: 'expired-token',
      user: { id: 'user-1' },
    }));

    expect(new AuthStorageAdapter().getItem(AUTH_KEY)).toBeNull();
    await vi.runAllTimersAsync();

    expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(expiredActivity);
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBe(expiredActivity);
  });
});
