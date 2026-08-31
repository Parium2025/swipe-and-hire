/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://app.parium.test/"}
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ name: string; args: unknown }>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({
        data: {
          session: {
            access_token: 'valid-token',
            expires_at: Math.floor(Date.now() / 1000) + 3_600,
            user: { id: 'user-1', email: 'user@example.com' },
          },
        },
        error: null,
      }),
      refreshSession: () => Promise.resolve({
        data: { session: null },
        error: null,
      }),
    },
    rpc: (name: string, args: unknown) => {
      h.rpcCalls.push({ name, args });
      return Promise.resolve({ data: { status: 'registered' }, error: null });
    },
    removeChannel: () => Promise.resolve(),
  },
}));

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: () => {
    const channel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return channel;
  },
}));

import {
  beginSignOutTracking,
  endSignOutTracking,
  useSessionManager,
} from '@/hooks/useSessionManager';

type RollbackControls = {
  removeSession: () => Promise<void>;
  restoreSessionRegistration?: () => Promise<void>;
};

let latestControls: RollbackControls | null = null;
const onKicked = vi.fn();

const Probe = () => {
  latestControls = useSessionManager('user-1', onKicked);
  return null;
};

describe('useSessionManager sign-out rollback', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    h.rpcCalls = [];
    latestControls = null;
    onKicked.mockReset();
    endSignOutTracking();
  });

  afterEach(() => {
    endSignOutTracking();
    cleanup();
  });

  it('re-registers the same browser device after a removed session must be rolled back', async () => {
    render(<Probe />);
    await waitFor(() => {
      expect(h.rpcCalls.filter(({ name }) => name === 'register_session')).toHaveLength(1);
    });

    beginSignOutTracking();
    await act(async () => {
      await latestControls!.removeSession();
    });
    expect(h.rpcCalls.filter(({ name }) => name === 'remove_session')).toHaveLength(1);

    endSignOutTracking();
    expect(typeof latestControls!.restoreSessionRegistration).toBe('function');
    await act(async () => {
      await latestControls!.restoreSessionRegistration!();
    });

    expect(h.rpcCalls.filter(({ name }) => name === 'register_session')).toHaveLength(2);
    const registrationTokens = h.rpcCalls
      .filter(({ name }) => name === 'register_session')
      .map(({ args }) => (args as { p_session_token: string }).p_session_token);
    expect(new Set(registrationTokens).size).toBe(1);
  });
});
