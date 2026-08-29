import { describe, it, expect } from 'vitest';
import { fetchJobseekerDashboardStats } from '@/lib/jobseekerDashboardStats';

/**
 * RED-steg Produktionshärdning 1.
 * Definierar önskat beteende för dashboard-stats-hämtning:
 * ett RPC-fel ska vara ett riktigt query-fel (reject/throw), aldrig ett
 * "lyckat" svar med falska nollor.
 */

const USER_ID = 'user-abc';

const SERVER_STATS = {
  applications: 7,
  interviews: 2,
  saved_jobs: 3,
  unread_messages: 5,
};

describe('fetchJobseekerDashboardStats', () => {
  it('avvisar när RPC returnerar error — aldrig falska nollor', async () => {
    const fakeClient = {
      rpc: async () => ({ data: null, error: new Error('RPC failed') }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(fetchJobseekerDashboardStats(USER_ID, fakeClient as any)).rejects.toThrow('RPC failed');
  });

  it('returnerar serverns statistik oförändrad vid lyckad RPC', async () => {
    const fakeClient = {
      rpc: async () => ({ data: SERVER_STATS, error: null }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchJobseekerDashboardStats(USER_ID, fakeClient as any);
    expect(result).toEqual(SERVER_STATS);
  });

  it('anropar rätt RPC med user-id som parameter', async () => {
    const calls: Array<{ fn: string; params: unknown }> = [];
    const fakeClient = {
      rpc: async (fn: string, params: unknown) => {
        calls.push({ fn, params });
        return { data: SERVER_STATS, error: null };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchJobseekerDashboardStats(USER_ID, fakeClient as any);
    expect(calls).toEqual([
      { fn: 'get_jobseeker_dashboard_stats', params: { p_user_id: USER_ID } },
    ]);
  });
});
