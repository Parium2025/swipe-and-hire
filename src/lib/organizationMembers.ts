import { supabase } from '@/integrations/supabase/client';
import { fetchCachedOrgMemberProfiles } from '@/lib/orgMemberProfiles';

/** Member IDs come from an authenticated, organization-scoped RPC: user_roles SELECT only exposes the caller's own row. */
export async function getOrganizationMemberIds(organizationId: string): Promise<string[]> {
  const data = await fetchCachedOrgMemberProfiles();
  return Array.from(new Set(data.filter(member => member.is_active && member.organization_id === organizationId).map(member => member.user_id)));
}

/** Reviews are historically keyed to the founding employer, not the organization's UUID. */
export async function getOrganizationReviewOwnerId(userId: string, organizationId?: string | null): Promise<string> {
  if (!organizationId) return userId;
  const data = await fetchCachedOrgMemberProfiles(userId);
  const admins = data.filter(member => member.organization_id === organizationId && member.is_active && member.role === 'admin');
  if (admins.length === 0) return userId;
  // The legacy review key is a profile UUID, not the organization UUID.
  // Query only authorized member IDs; never match a company name across organizations.
  const { data: reviews, error: reviewsError } = await supabase
    .from('company_reviews_public').select('company_id').in('company_id', admins.map(member => member.user_id)).limit(1);
  if (reviewsError) throw reviewsError;
  return reviews?.[0]?.company_id ?? admins[0].user_id;
}
