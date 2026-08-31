// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingVerification,
  getPendingVerificationEmail,
  hasPendingVerification,
  markPendingVerification,
} from '@/lib/pendingVerification';

const KEY = 'parium-pending-verification';

describe('pending verification storage', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
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

  it('stores a normalized email with a bounded lifetime', () => {
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'));

    markPendingVerification('  USER@Example.COM  ');

    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(stored).toMatchObject({ version: 1, email: 'user@example.com' });
    expect(stored.expiresAt).toBeGreaterThan(Date.now());
    expect(stored.expiresAt).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(hasPendingVerification()).toBe(true);
    expect(getPendingVerificationEmail()).toBe('user@example.com');
  });

  it('expires and removes stale records', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, email: 'old@example.com', expiresAt: Date.now() - 1 }),
    );

    expect(hasPendingVerification()).toBe(false);
    expect(getPendingVerificationEmail()).toBe('');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('fails closed and removes unbounded legacy values', () => {
    localStorage.setItem(KEY, 'legacy@example.com');

    expect(hasPendingVerification()).toBe(false);
    expect(getPendingVerificationEmail()).toBe('');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('clears the record explicitly', () => {
    markPendingVerification('user@example.com');
    clearPendingVerification();

    expect(hasPendingVerification()).toBe(false);
  });
});
