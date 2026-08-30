import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { shouldTrackUrl, isReportingUrl, type AppFailure } from '@/lib/appFailureMonitor';
import { reportAppException, __resetAppExceptionThrottleForTests } from '@/lib/statusAlerts';

const failure: AppFailure = {
  id: 'x',
  kind: 'backend_error',
  severity: 'critical',
  title: 'fail',
  message: '503',
  route: '/home',
  createdAt: Date.now(),
  fingerprint: 'fp-1',
  occurrenceCount: 1,
  lastSeenAt: Date.now(),
};

describe('app exception reporting loop guard', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    __resetAppExceptionThrottleForTests();
  });

  it('never monitors the reporting endpoints themselves', () => {
    expect(isReportingUrl('https://x.supabase.co/rest/v1/rpc/record_app_exception')).toBe(true);
    expect(shouldTrackUrl('https://x.supabase.co/rest/v1/rpc/record_app_exception')).toBe(false);
    expect(shouldTrackUrl('https://x.supabase.co/functions/v1/send-push-notification')).toBe(false);
    expect(shouldTrackUrl('https://x.supabase.co/rest/v1/job_postings')).toBe(true);
  });

  it('rate limits reports within a window', async () => {
    rpcMock.mockResolvedValue({ error: null });
    for (let i = 0; i < 20; i += 1) await reportAppException(failure, 'user-1');
    expect(rpcMock).toHaveBeenCalledTimes(5);
  });

  it('opens a circuit breaker after repeated failures', async () => {
    rpcMock.mockResolvedValue({ error: new Error('503') });
    for (let i = 0; i < 5; i += 1) {
      await reportAppException(failure, 'user-1').catch(() => undefined);
    }
    expect(rpcMock).toHaveBeenCalledTimes(3);
  });
});
