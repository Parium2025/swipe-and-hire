import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  signOutCalls: 0,
  signOutResult: null as Promise<{ error: { message: string } | null }> | null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      refreshSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => {
        h.signOutCalls += 1;
        return h.signOutResult ?? Promise.resolve({ error: null });
      },
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

import { clearInactivityLogoutFlag, useInactivityTimeout } from '@/hooks/useInactivityTimeout';

const LAST_ACTIVITY_KEY = 'parium-last-activity';

const Probe = ({ authenticated = true }: { authenticated?: boolean }) => {
  useInactivityTimeout(authenticated);
  return null;
};

describe('useInactivityTimeout human-activity boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    h.signOutCalls = 0;
    h.signOutResult = null;
    clearInactivityLogoutFlag();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(document, 'visibilityState');
    vi.restoreAllMocks();
  });

  it('does not refresh the inactivity clock merely because an authenticated provider mounts', () => {
    const lastHumanActivity = String(Date.now() - 60 * 60 * 1000);
    localStorage.setItem(LAST_ACTIVITY_KEY, lastHumanActivity);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, lastHumanActivity);

    render(<Probe />);

    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(lastHumanActivity);
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBe(lastHumanActivity);
  });

  it('still refreshes the inactivity clock after an actual interaction', () => {
    const lastHumanActivity = String(Date.now() - 60 * 60 * 1000);
    localStorage.setItem(LAST_ACTIVITY_KEY, lastHumanActivity);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, lastHumanActivity);

    render(<Probe />);
    act(() => {
      window.dispatchEvent(new MouseEvent('mousedown'));
    });

    expect(Number(localStorage.getItem(LAST_ACTIVITY_KEY))).toBeGreaterThan(Number(lastHumanActivity));
    expect(Number(sessionStorage.getItem(LAST_ACTIVITY_KEY))).toBeGreaterThan(Number(lastHumanActivity));
  });

  it('checks expiry before a pointer interaction can revive an expired session', async () => {
    const expiredActivity = String(Date.now() - 25 * 60 * 60 * 1000);
    localStorage.setItem(LAST_ACTIVITY_KEY, expiredActivity);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, expiredActivity);

    render(<Probe />);
    await act(async () => {
      window.dispatchEvent(new MouseEvent('mousedown'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(h.signOutCalls).toBe(1);
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
  });

  it('checks expiry before foreground visibility can revive an expired session', async () => {
    const expiredActivity = String(Date.now() - 25 * 60 * 60 * 1000);
    localStorage.setItem(LAST_ACTIVITY_KEY, expiredActivity);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, expiredActivity);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    render(<Probe />);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(h.signOutCalls).toBe(1);
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
  });

  it('keeps the expired activity marker and retries after credential logout fails', async () => {
    const expiredActivity = String(Date.now() - 25 * 60 * 60 * 1000);
    localStorage.setItem(LAST_ACTIVITY_KEY, expiredActivity);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, expiredActivity);
    h.signOutResult = Promise.resolve({ error: { message: 'network unavailable' } });

    render(<Probe />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(h.signOutCalls).toBe(1);
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(expiredActivity);
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBe(expiredActivity);

    await act(async () => {
      window.dispatchEvent(new MouseEvent('mousedown'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(h.signOutCalls).toBe(2);
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(expiredActivity);
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBe(expiredActivity);
  });
});
