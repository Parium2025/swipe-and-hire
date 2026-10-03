import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const select = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc,
    from: () => ({ select }),
  },
}));

import { getOrganizationMemberIds, getOrganizationReviewOwnerId } from '@/lib/organizationMembers';

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
    rpc.mockResolvedValue({ data: members, error: null });
  });

  it('loads active organization members through the authorized RPC, not user_roles RLS', async () => {
    expect(await getOrganizationMemberIds()).toEqual(['owner', 'recruiter', 'other-org']);
    expect(rpc).toHaveBeenCalledWith('get_my_organization_member_profiles');
  });

  it('finds the existing review owner among this organization’s admins only', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ company_id: 'owner' }], error: null });
    const inQuery = vi.fn().mockReturnValue({ limit });
    select.mockReturnValue({ in: inQuery });
    expect(await getOrganizationReviewOwnerId('recruiter', org)).toBe('owner');
    expect(inQuery).toHaveBeenCalledWith('company_id', ['owner']);
  });

  it('retains personal identity outside an organization', async () => {
    expect(await getOrganizationReviewOwnerId('recruiter')).toBe('recruiter');
    expect(rpc).not.toHaveBeenCalled();
  });
});