import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isOwnerEmail } from '@/lib/ownerAccess';
import { useIsPlatformAdmin } from '@/hooks/useIsPlatformAdmin';


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
 * Syntetisk "ägar-plan" som ger obegränsad åtkomst utan riktig prenumeration.
 * Används enbart för e-postadresser i OWNER_EMAILS.
 */
const OWNER_PLAN: ActivePlanDetails = {
  source_type: 'subscription',
  tier: 'pro',
  status: 'active',
  expires_at: null,
  max_active_jobs: null,
  max_users: null,
  plan_name: 'Ägare',
  price_sek: 0,
};

/**
 * Kollar om användaren har en aktiv plan (personlig, org, eller engångsköp).
 * Används för att låsa "Publicera annons"-flödet.
 * Ägare (se OWNER_EMAILS) räknas alltid som Pro utan att behöva betala.
 */
export function useHasActivePlan() {
  const { user } = useAuth();
  const { isPlatformAdmin, loading: adminLoading } = useIsPlatformAdmin();
  // Ägare via e-post ELLER plattformsadmin (samma regel som databasens trigger).
  const ownerBypass = isOwnerEmail(user?.email) || isPlatformAdmin;

  const query = useQuery({
    queryKey: ['active-plan', user?.id, ownerBypass],
    queryFn: async (): Promise<ActivePlanDetails | null> => {
      if (!user) return null;
      if (ownerBypass) return OWNER_PLAN;
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
    enabled: !!user && !adminLoading,
    staleTime: 60_000,
  });

  return {
    plan: query.data ?? null,
    hasPlan: !!query.data,
    tier: query.data?.tier ?? null,
    expiresAt: query.data?.expires_at ?? null,
    isOwner: ownerBypass,
    loading: adminLoading || query.isLoading,
    refetch: query.refetch,
  };
}


