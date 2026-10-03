import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getOrganizationMemberIds } from '@/lib/organizationMembers';
import { createRealtimeChannel } from '@/lib/realtimeChannel';

type Ratings = Record<string, { own?: number; colleague?: number }>;

/** Ratings are personal, but colleagues' ratings are visible inside the current organization. */
export function useOrganizationCandidateRatings(applicantIds: string[]): Ratings {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const idsKey = useMemo(() => [...new Set(applicantIds)].sort().join('|'), [applicantIds]);
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
      return result;
    },
  });

  useEffect(() => {
    if (!user || !idsKey) return;
    const visible = new Set(idsKey.split('|'));
    const channel = createRealtimeChannel(`organization-candidate-ratings-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_ratings' }, payload => {
        const row = (payload.new ?? payload.old) as { applicant_id?: string };
        if (!row.applicant_id || visible.has(row.applicant_id)) {
          queryClient.invalidateQueries({ queryKey: ['organization-candidate-ratings', user.id] });
          queryClient.invalidateQueries({ queryKey: ['candidate-colleague-rating', user.id] });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, idsKey, queryClient]);

  return isSuccess ? data ?? {} : {};
}