import { describe, it, expect } from 'vitest';
import { fetchJobseekerDashboardStats } from '@/lib/jobseekerDashboardStats';

/**
 * RED-steg Produktionshärdning 1.
 * Definierar önskat beteende för dashboard-stats-hämtning:
 * ett RPC-fel ska vara ett riktigt query-fel (reject/throw), aldrig ett
 * "lyckat" svar med falska nollor.
 */

const SERVER_STATS = {
  applications_count: 7,
  saved_jobs_count: 3,
  profile_views: 12,
};

describe('fetchJobseekerDashboardStats', () => {
  it('avvisar när RPC returnerar error — aldrig falska nollor', async () => {
    const fakeClient = {
      rpc: async () => ({ data: null, error: new Error('RPC failed') }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(fetchJobseekerDashboardStats(fakeClient as any)).rejects.toThrow('RPC failed');
  });

  it('returnerar serverns statistik oförändrad vid lyckad RPC', async () => {
    const fakeClient = {
      rpc: async () => ({ data: SERVER_STATS, error: null }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchJobseekerDashboardStats(fakeClient as any);
    expect(result).toEqual(SERVER_STATS);
  });

  it('anropar rätt RPC', async () => {
    const calls: string[] = [];
    const fakeClient = {
      rpc: async (fn: string) => {
        calls.push(fn);
        return { data: SERVER_STATS, error: null };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchJobseekerDashboardStats(fakeClient as any);
    expect(calls).toEqual(['get_jobseeker_dashboard_stats']);
  });
});
