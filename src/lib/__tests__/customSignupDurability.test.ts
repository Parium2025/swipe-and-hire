import { runDurableSignup } from '../../../supabase/functions/custom-signup/orchestrator';

describe('durable custom signup orchestration', () => {
  it('awaits rate limit, identity commit, and token persistence in order', async () => {
    const events: string[] = [];
    const delivery = { confirmationUrl: 'https://www.parium.se/email-confirm#confirm=test' };

    const result = await runDurableSignup({
      reserveRateLimit: async () => {
        events.push('rate-limit');
        return true;
      },
      createIdentity: async () => {
        events.push('identity');
        return { userId: 'user-1' };
      },
      issueConfirmation: async (userId) => {
        events.push(`token:${userId}`);
        return { delivery };
      },
      reportFailure: vi.fn(),
    });

    expect(events).toEqual(['rate-limit', 'identity', 'token:user-1']);
    expect(result).toBe(delivery);
  });

  it('does not create an identity when the coarse reservation is blocked', async () => {
    const createIdentity = vi.fn();

    const result = await runDurableSignup({
      reserveRateLimit: async () => false,
      createIdentity,
      issueConfirmation: vi.fn(),
      reportFailure: vi.fn(),
    });

    expect(result).toBeNull();
    expect(createIdentity).not.toHaveBeenCalled();
  });

  it('keeps a committed identity recoverable when token persistence fails', async () => {
    const reportFailure = vi.fn();

    const result = await runDurableSignup({
      reserveRateLimit: async () => true,
      createIdentity: async () => ({ userId: 'user-1' }),
      issueConfirmation: async () => ({ delivery: null, errorCode: 'token_unavailable' }),
      reportFailure,
    });

    expect(result).toBeNull();
    expect(reportFailure).toHaveBeenCalledWith('confirmation', 'token_unavailable');
  });

  it('makes simultaneous retries one create plus one safe existing-user no-op', async () => {
    let createAttempts = 0;
    const issueConfirmation = vi.fn(async (userId: string) => ({
      delivery: { userId },
    }));
    const dependencies = {
      reserveRateLimit: async () => true,
      createIdentity: async () => {
        createAttempts += 1;
        return createAttempts === 1
          ? { userId: 'user-1' }
          : { userId: null, existing: true };
      },
      issueConfirmation,
      reportFailure: vi.fn(),
    };

    const [first, second] = await Promise.all([
      runDurableSignup(dependencies),
      runDurableSignup(dependencies),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(issueConfirmation).toHaveBeenCalledOnce();
    expect(issueConfirmation).toHaveBeenCalledWith('user-1');
  });
});
