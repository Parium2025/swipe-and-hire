import { beforeEach, describe, expect, it } from 'vitest';
import { getTabAuthUserId } from '@/lib/authStorage';

const AUTH_KEY = 'sb-example-auth-token';

describe('authStorage tab isolation', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('läser endast kontot som är lagrat i den aktuella fliken', () => {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify({ user: { id: 'account-a' } }));
    expect(getTabAuthUserId()).toBe('account-a');
  });

  it('läser base64-kodade authsessioner', () => {
    const value = btoa(JSON.stringify({ currentSession: { user: { id: 'account-b' } } }));
    sessionStorage.setItem(AUTH_KEY, `base64-${value}`);
    expect(getTabAuthUserId()).toBe('account-b');
  });

  it('ignorerar trasiga och orelaterade lagringsvärden', () => {
    sessionStorage.setItem(AUTH_KEY, '{broken');
    sessionStorage.setItem('unrelated', JSON.stringify({ user: { id: 'wrong' } }));
    expect(getTabAuthUserId()).toBeNull();
  });
});