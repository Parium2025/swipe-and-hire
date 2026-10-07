// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { findUserByEmail } from '../../../supabase/functions/_shared/find-user';

describe('Indexed authentication email lookup', () => {
  it('normalizes the address and fetches only the matched account', async () => {
    const user = { id: 'one', email: 'Person@example.test', email_confirmed_at: 'confirmed' };
    const rpc = vi.fn().mockResolvedValue({ data: [{ user_id: 'one' }], error: null });
    const getUserById = vi.fn().mockResolvedValue({ data: { user }, error: null });
    expect(await findUserByEmail({ rpc, auth: { admin: { getUserById } } }, ' PERSON@example.test ')).toEqual(user);
    expect(rpc).toHaveBeenCalledWith('lookup_auth_email_for_resend', { _email: 'person@example.test' });
    expect(getUserById).toHaveBeenCalledOnce();
  });
  it('does not fetch an account when there is no exact match', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const getUserById = vi.fn();
    expect(await findUserByEmail({ rpc, auth: { admin: { getUserById } } }, 'new@example.test')).toBeNull();
    expect(getUserById).not.toHaveBeenCalled();
  });
  it('does not treat lookup failures as missing accounts', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'Unavailable' } });
    const getUserById = vi.fn();
    await expect(findUserByEmail({ rpc, auth: { admin: { getUserById } } }, 'person@example.test')).rejects.toThrow('Unavailable');
    expect(getUserById).not.toHaveBeenCalled();
  });
  it('rejects an address changed between lookup and retrieval', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ user_id: 'one' }], error: null });
    const getUserById = vi.fn().mockResolvedValue({ data: { user: { id: 'one', email: 'other@example.test' } }, error: null });
    expect(await findUserByEmail({ rpc, auth: { admin: { getUserById } } }, 'person@example.test')).toBeNull();
  });
});