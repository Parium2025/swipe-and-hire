import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, select, getSession } = vi.hoisted(() => ({ rpc: vi.fn(), select: vi.fn(), getSession: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc,
    from: () => ({ select }),
    auth: { getSession },
  },
}));

import { getOrganizationMemberIds, getOrganizationReviewOwnerId } from '@/lib/organizationMembers';
import { invalidateOrgMemberProfiles } from '@/lib/orgMemberProfiles';

const org = 'org-a';
const members = [
  { user_id: 'owner', role: 'admin', organization_id: org, is_active: true },
  { user_id: 'recruiter', role: 'recruiter', organization_id: org, is_active: true },
  { user_id: 'old-member', role: 'recruiter', organization_id: org, is_active: false },
  { user_id: 'other-org', role: 'admin', organization_id: 'org-b', is_active: true },
];

describe('organization member scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateOrgMemberProfiles('user-1');
    getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    rpc.mockResolvedValue({ data: members, error: null });
  });

  it('loads active organization members through the authorized RPC, not user_roles RLS', async () => {
    expect(await getOrganizationMemberIds(org)).toEqual(['owner', 'recruiter']);
    expect(rpc).toHaveBeenCalledWith('get_my_organization_member_profiles');
  });

  it('serves repeat lookups from the shared per-account cache', async () => {
    await getOrganizationMemberIds(org);
    await getOrganizationMemberIds(org);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('resolves the review owner server-side via company_owner_id', async () => {
    rpc.mockResolvedValueOnce({ data: [{ user_id: 'recruiter', owner_id: 'owner' }], error: null });
    expect(await getOrganizationReviewOwnerId('recruiter', org)).toBe('owner');
    expect(rpc).toHaveBeenCalledWith('resolve_company_owner_ids', { p_user_ids: ['recruiter'] });
  });

  it('retains personal identity outside an organization', async () => {
    expect(await getOrganizationReviewOwnerId('recruiter')).toBe('recruiter');
    expect(rpc).not.toHaveBeenCalled();
  });
});
