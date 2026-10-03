import { supabase } from '@/integrations/supabase/client';

/** Member IDs come from an authenticated, organization-scoped RPC: user_roles SELECT only exposes the caller's own row. */
export async function getOrganizationMemberIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_my_organization_member_profiles');
  if (error) throw error;
  return Array.from(new Set((data ?? []).filter(member => member.is_active).map(member => member.user_id)));
}

/** Reviews are historically keyed to the founding employer, not the organization's UUID. */
export async function getOrganizationReviewOwnerId(userId: string, organizationId?: string | null): Promise<string> {
  if (!organizationId) return userId;
  const { data, error } = await supabase.rpc('get_my_organization_member_profiles');
  if (error) throw error;
  const founder = data?.find(member => member.organization_id === organizationId && member.is_active && member.role === 'admin');
  return founder?.user_id ?? userId;
}