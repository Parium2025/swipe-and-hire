import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getOrganizationMemberIds } from '@/lib/organizationMembers';
import { createRealtimeChannel } from '@/lib/realtimeChannel';

type Ratings = Record<string, { own?: number; colleague?: number }>;

/** Account-scoped persisted ratings so stars render on the first frame after tab switches and cold starts. */
export const ORG_RATINGS_CACHE_PREFIX = 'parium_org_ratings_v1_';
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
    queryFn: async (): Promise<Ratings> => {
      if (!user || !idsKey) return {};
      const { data: role, error: roleError } = await supabase.from('user_roles')
        .select('organization_id').eq('user_id', user.id).eq('is_active', true)
        .not('organization_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (roleError) throw roleError;
      const memberIds = role?.organization_id
        ? await getOrganizationMemberIds(role.organization_id)
        : [user.id];
      const allowed = [...new Set([user.id, ...memberIds])];
      const result: Ratings = {};
      const ids = idsKey.split('|');
      // Bound request size and paginate so large teams cannot silently lose ratings.
      for (let start = 0; start < ids.length; start += 100) {
        const chunk = ids.slice(start, start + 100);
        for (let offset = 0; ; offset += 1000) {
          const { data: rows, error } = await supabase.from('candidate_ratings')
            .select('applicant_id, recruiter_id, rating, updated_at')
            .in('applicant_id', chunk).in('recruiter_id', allowed)
            .order('updated_at', { ascending: false }).range(offset, offset + 999);
          if (error) throw error;
          for (const row of rows ?? []) {
            const entry = result[row.applicant_id] ?? (result[row.applicant_id] = {});
            if (row.recruiter_id === user.id) entry.own = row.rating;
            else if (entry.colleague === undefined) entry.colleague = row.rating;
          }
          if (!rows || rows.length < 1000) break;
        }
      }
      writePersisted(user.id, ids, result);
      return result;
    },
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

  return isSuccess && data ? { ...persisted, ...data } : persisted;
}