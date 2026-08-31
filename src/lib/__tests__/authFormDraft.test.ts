// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthDraft, loadAuthDraft, saveAuthDraft } from '@/lib/authFormDraft';

const KEY = 'parium_auth_draft_v1';

describe('Auth form draft isolation', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() { return values.size; },
    });
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores a bounded draft without passwords', () => {
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'));
    saveAuthDraft({
      role: 'job_seeker',
      jobSeeker: { email: 'user@example.com', password: 'secret', confirmPassword: 'secret' },
    });

    const stored = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
    expect(stored.version).toBe(2);
    expect(stored.expiresAt).toBeGreaterThan(Date.now());
    expect(stored.expiresAt).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);
    expect(JSON.stringify(stored)).not.toContain('secret');
    expect(loadAuthDraft().jobSeeker?.email).toBe('user@example.com');
  });

  it('fails closed and removes stale or legacy drafts', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ role: 'employer', employer: { email: 'old@example.com' } }));
    expect(loadAuthDraft()).toEqual({});
    expect(sessionStorage.getItem(KEY)).toBeNull();

    sessionStorage.setItem(
      KEY,
      JSON.stringify({ version: 2, expiresAt: Date.now() - 1, draft: { role: 'job_seeker' } }),
    );
    expect(loadAuthDraft()).toEqual({});
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('clears explicitly', () => {
    saveAuthDraft({ role: 'job_seeker' });
    clearAuthDraft();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
