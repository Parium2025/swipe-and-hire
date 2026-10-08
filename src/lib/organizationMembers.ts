import { fetchCachedOrgMemberProfiles } from '@/lib/orgMemberProfiles';
import { resolveCompanyOwnerId } from '@/lib/companyOwner';

/** Member IDs come from an authenticated, organization-scoped RPC: user_roles SELECT only exposes the caller's own row. */
export async function getOrganizationMemberIds(organizationId: string): Promise<string[]> {
  const data = await fetchCachedOrgMemberProfiles();
  return Array.from(new Set(data.filter(member => member.is_active && member.organization_id === organizationId).map(member => member.user_id)));
}

/** Reviews belong to the company identity resolved server-side by `company_owner_id`. */
export async function getOrganizationReviewOwnerId(userId: string, organizationId?: string | null): Promise<string> {
  if (!organizationId || !userId) return userId;
  return resolveCompanyOwnerId(userId);
}
