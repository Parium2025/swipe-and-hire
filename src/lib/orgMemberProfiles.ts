import { supabase } from '@/integrations/supabase/client';
import { clearPersistentCacheByPrefix, readThroughCache } from '@/lib/performanceGuards';

/**
 * Delad, kontobunden cache för `get_my_organization_member_profiles`.
 *
 * Den auktoriserade RPC:n anropades tidigare från sex olika ställen utan
 * gemensam lagring (5101 anrop mot den lilla instansen). Här finns EN väg in:
 * persistent cache per konto + in-flight-dedup via readThroughCache, så att
 * samtidiga vyer delar samma svar och kalla starter ritas direkt från cachen.
 */

export interface OrgMemberProfile {
  user_id: string;
  role: string;
  is_active: boolean;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_image_url: string;
}

const CACHE_PREFIX = 'parium_org_member_profiles_v1_';
const TTL_MS = 5 * 60 * 1000;

/** Obligatorisk cache-validering: varje rad måste vara ett medlemsobjekt. */
function isOrgMemberProfiles(data: unknown): data is OrgMemberProfile[] {
  return Array.isArray(data) && data.every((row) =>
    Boolean(
      row &&
      typeof row === 'object' &&
      typeof (row as OrgMemberProfile).user_id === 'string' &&
      typeof (row as OrgMemberProfile).organization_id === 'string',
    ));
}

async function currentUserId(userId?: string | null): Promise<string | null> {
  if (userId) return userId;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Medlemslistan för anroparens organisation. Utan ett kända konto-id hämtas
 * den utan cache (svaret är ändå skopat till inloggad användare på servern).
 */
export async function fetchCachedOrgMemberProfiles(userId?: string | null): Promise<OrgMemberProfile[]> {
  const uid = await currentUserId(userId);
  if (!uid) {
    const { data, error } = await supabase.rpc('get_my_organization_member_profiles');
    if (error) throw error;
    return (data ?? []) as OrgMemberProfile[];
  }

  return readThroughCache<OrgMemberProfile[]>(
    `${CACHE_PREFIX}${uid}`,
    TTL_MS,
    async () => {
      const { data, error } = await supabase.rpc('get_my_organization_member_profiles');
      if (error) throw error;
      return (data ?? []) as OrgMemberProfile[];
    },
    isOrgMemberProfiles,
  );
}

/**
 * Tömmer den här kontots cache. Måste anropas när teamet ändrats (inbjudan
 * accepterad, medlem borttagen eller roll ändrad) så att listor inte visar
 * en gammal sammansättning i upp till fem minuter.
 */
export function invalidateOrgMemberProfiles(userId: string | null | undefined): void {
  if (!userId) return;
  clearPersistentCacheByPrefix(`${CACHE_PREFIX}${userId}`);
}
