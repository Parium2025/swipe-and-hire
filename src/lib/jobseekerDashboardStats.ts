/**
 * Hämtning av jobbsökarens dashboard-statistik.
 *
 * Ett RPC-fel är ett RIKTIGT query-fel — aldrig ett "lyckat" svar med
 * falska nollor. Anroparen (React Query) fångar felet och visar stale
 * cache-data i stället.
 */

export interface JobseekerDashboardStats {
  applications: number;
  interviews: number;
  saved_jobs: number;
  unread_messages: number;
}

/** Minimal, testbar klienttyp — SupabaseClient uppfyller detta. */
export interface RpcClient {
  rpc(
    fn: string,
    params: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

export async function fetchJobseekerDashboardStats(
  userId: string,
  client: RpcClient
): Promise<JobseekerDashboardStats> {
  const { data, error } = await client.rpc('get_jobseeker_dashboard_stats', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data as JobseekerDashboardStats;
}
