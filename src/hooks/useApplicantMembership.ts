import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  readApplicantMembershipCache,
  reconcileApplicantMembershipCache,
} from '@/lib/applicantMembershipCache';

/**
 * Serverkoll av vilka personer (applicant_id) som redan finns bland rekryterarens
 * kandidater — oavsett om just den kandidaten råkar vara laddad i minnet.
 *
 * Kandidatlistorna är paginerade (50 per kolumn), så en ren minneskoll kan visa
 * plus-ikon för en person som faktiskt redan ligger i en lista längre ner.
 * Den här hooken frågar servern för exakt de personer som visas just nu.
 */
export function useApplicantMembership(applicantIds: string[]) {
  const { user } = useAuth();

  const ids = useMemo(
    () => Array.from(new Set(applicantIds.filter(Boolean))).sort(),
    [applicantIds]
  );

  const cachedMembership = useMemo(
    () => (user ? readApplicantMembershipCache(user.id) : null),
    [user?.id],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['applicant-membership', user?.id, ids],
    enabled: !!user && ids.length > 0,
    staleTime: 0,
    initialData: () => cachedMembership
      ? ids.filter((id) => cachedMembership.has(id))
      : undefined,
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('my_candidates')
        .select('applicant_id')
        .eq('recruiter_id', user.id)
        .in('applicant_id', ids);

      if (error) throw error;
      const memberIds = (data ?? []).map((row) => row.applicant_id as string);
      reconcileApplicantMembershipCache(user.id, ids, memberIds);
      return memberIds;
    },
  });

  const membership = useMemo(() => new Set<string>(data ?? []), [data]);
  return { membership, isLoading: isLoading && !cachedMembership };
}
