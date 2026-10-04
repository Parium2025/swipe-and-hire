import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';

/** latest = senast satta betyget i organisationen; det delade betyget alla ser. */
type Ratings = Record<string, { own?: number; colleague?: number; latest?: number }>;

/** Account-scoped persisted ratings so stars render on the first frame after tab switches and cold starts. */
export const ORG_RATINGS_CACHE_PREFIX = 'parium_org_ratings_v2_';
function readPersisted(userId: string | undefined): Ratings {
  if (!userId) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(ORG_RATINGS_CACHE_PREFIX + userId) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Ratings : {};
  } catch { return {}; }
}
function writePersisted(userId: string, ids: string[], fresh: Ratings) {
  try {
    const merged = readPersisted(userId);
    for (const id of ids) {
      if (fresh[id]) merged[id] = fresh[id]; else delete merged[id];
    }
    const keys = Object.keys(merged);
    const trimmed: Ratings = {};
    keys.slice(-3000).forEach((k) => { trimmed[k] = merged[k]; });
    localStorage.setItem(ORG_RATINGS_CACHE_PREFIX + userId, JSON.stringify(trimmed));
  } catch { /* ignore quota */ }
}

let memberCache: { userId: string; ids: string[]; at: number } | null = null;
/** Active members of the caller's organization; one RPC, cached briefly per account. */
async function getMemberIds(userId: string): Promise<string[]> {
  if (memberCache?.userId === userId && Date.now() - memberCache.at < 60_000) return memberCache.ids;
  const { data, error } = await supabase.rpc('get_my_organization_member_profiles');
  if (error) throw error;
  const ids = [...new Set([userId, ...(data ?? []).filter((m) => m.is_active).map((m) => m.user_id)])];
  memberCache = { userId, ids, at: Date.now() };
  return ids;
}

/** Fetches shared ratings and persists them for this account (also used for background warming). */
export async function fetchOrganizationRatings(userId: string, ids: string[]): Promise<Ratings> {
  const result: Ratings = {};
  if (!ids.length) return result;
  const allowed = await getMemberIds(userId);
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += 100) chunks.push(ids.slice(start, start + 100));
  await Promise.all(chunks.map(async (chunk) => {
    const local: Ratings = {};
    for (let offset = 0; ; offset += 1000) {
      const { data: rows, error } = await supabase.from('candidate_ratings')
        .select('applicant_id, recruiter_id, rating, updated_at')
        .in('applicant_id', chunk).in('recruiter_id', allowed)
        .order('updated_at', { ascending: false }).range(offset, offset + 999);
      if (error) throw error;
      for (const row of rows ?? []) {
        const entry = local[row.applicant_id] ?? (local[row.applicant_id] = {});
        if (entry.latest === undefined && row.rating > 0) entry.latest = row.rating;
        if (row.recruiter_id === userId) entry.own = row.rating;
        else if (entry.colleague === undefined) entry.colleague = row.rating;
      }
      if (!rows || rows.length < 1000) break;
    }
    Object.assign(result, local);
  }));
  writePersisted(userId, ids, result);
  return result;
}

/** Ratings are personal, but colleagues' ratings are visible inside the current organization. */
export function useOrganizationCandidateRatings(applicantIds: string[]): Ratings {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const idsKey = useMemo(() => [...new Set(applicantIds)].sort().join('|'), [applicantIds]);
  const visibleIds = useRef<Set<string>>(new Set());
  visibleIds.current = new Set(idsKey ? idsKey.split('|') : []);
  const queryKey = useMemo(() => ['organization-candidate-ratings', user?.id, idsKey], [user?.id, idsKey]);

  const { data, isSuccess } = useQuery({
    queryKey,
    enabled: !!user?.id && !!idsKey,
    staleTime: 30_000,
    queryFn: () => fetchOrganizationRatings(user!.id, idsKey.split('|')),
  });

  // Last known ratings for this account: shown until the fresh answer arrives,
  // also when the visible id set grows (pagination) and the query key changes.
  const persisted = useMemo(() => readPersisted(user?.id), [user?.id, data]);

  useEffect(() => {
    if (!user) return;
    const channel = createRealtimeChannel(`organization-candidate-ratings-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_ratings' }, payload => {
        const row = (payload.new ?? payload.old) as { applicant_id?: string };
        if (!row.applicant_id || visibleIds.current.has(row.applicant_id)) {
          queryClient.invalidateQueries({ queryKey: ['organization-candidate-ratings', user.id] });
          queryClient.invalidateQueries({ queryKey: ['candidate-colleague-rating', user.id] });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  return isSuccess && data ? data : persisted;
}