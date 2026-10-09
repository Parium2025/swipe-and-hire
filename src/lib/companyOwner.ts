import { supabase } from '@/integrations/supabase/client';

/**
 * Ett bolag = en identitet. Recensioner och företagskort hör till bolagets
 * ägarkonto (organisationens första admin), oavsett vilken kollega som
 * publicerade annonsen. Servern avgör ägaren; svaret cachas i minnet.
 */
const ownerCache = new Map<string, string>();

export async function resolveCompanyOwnerIds(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const missing = unique.filter((id) => !ownerCache.has(id));
  if (missing.length > 0) {
    const { data, error } = await supabase.rpc('resolve_company_owner_ids', { p_user_ids: missing });
    if (error) throw error;
    (data || []).forEach((row: { user_id: string; owner_id: string }) => {
      if (row.user_id && row.owner_id) ownerCache.set(row.user_id, row.owner_id);
    });
    if (missing.some((id) => !ownerCache.has(id))) throw new Error('Företagskopplingen kunde inte hämtas.');
  }
  return new Map(unique.map((id) => [id, ownerCache.get(id) ?? id]));
}

export async function resolveCompanyOwnerId(id: string): Promise<string> {
  return (await resolveCompanyOwnerIds([id])).get(id) ?? id;
}
