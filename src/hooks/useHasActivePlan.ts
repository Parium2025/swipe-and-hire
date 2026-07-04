import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type PlanTier = 'one_time' | 'start' | 'vaxa' | 'pro' | 'jobseeker_premium';
export type PlanStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export interface ActivePlanDetails {
  source_type: 'subscription' | 'org_subscription' | 'one_time';
  tier: PlanTier;
  status: PlanStatus;
  expires_at: string | null;
  max_active_jobs: number | null;
  max_users: number | null;
  plan_name: string;
  price_sek: number;
}

/**
 * Kollar om användaren har en aktiv plan (personlig, org, eller engångsköp).
 * Används för att låsa "Publicera annons"-flödet.
 */
export function useHasActivePlan() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['active-plan', user?.id],
    queryFn: async (): Promise<ActivePlanDetails | null> => {
      if (!user) return null;
      const { data, error } = await supabase.rpc('get_active_plan_details', {
        _user_id: user.id,
      });
      if (error) {
        console.warn('[useHasActivePlan] error:', error.message);
        return null;
      }
      const row = data?.[0];
      return row ? (row as unknown as ActivePlanDetails) : null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return {
    plan: query.data ?? null,
    hasPlan: !!query.data,
    tier: query.data?.tier ?? null,
    expiresAt: query.data?.expires_at ?? null,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
