import { describe, it, expect, beforeEach } from 'vitest';
import {
  writePersistentCache,
  readPersistentCache,
  invalidateCachedProfile,
} from '@/lib/performanceGuards';

type ProfileLite = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  profile_image_url: string | null;
  company_logo_url: string | null;
  role: 'job_seeker' | 'employer';
};

const isProfileLite = (data: unknown): data is ProfileLite =>
  Boolean(data && typeof data === 'object' && typeof (data as ProfileLite).user_id === 'string');

const TTL = 15 * 60 * 1000;
const keyFor = (userId: string) => `parium_profile_lite_v2_${userId}`;

const sampleProfile = (userId: string): ProfileLite => ({
  user_id: userId,
  first_name: 'Fredrik',
  last_name: 'Andits',
  company_name: 'Hoffstens Motor',
  profile_image_url: 'old-image.jpg',
  company_logo_url: null,
  role: 'employer',
});

describe('invalidateCachedProfile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rensar den cachade chattprofilen så ny bild hämtas direkt', () => {
    const userId = 'user-123';
    writePersistentCache(keyFor(userId), sampleProfile(userId));

    // Cachen är färsk och skulle normalt visas i upp till 15 minuter.
    expect(readPersistentCache(keyFor(userId), TTL, isProfileLite)?.profile_image_url).toBe('old-image.jpg');

    invalidateCachedProfile(userId);

    // Efter sparad profilbild får den gamla cachen aldrig användas igen.
    expect(readPersistentCache(keyFor(userId), TTL, isProfileLite)).toBeNull();
  });

  it('rör inte andra användares cachade profiler', () => {
    writePersistentCache(keyFor('user-a'), sampleProfile('user-a'));
    writePersistentCache(keyFor('user-b'), sampleProfile('user-b'));

    invalidateCachedProfile('user-a');

    expect(readPersistentCache(keyFor('user-a'), TTL, isProfileLite)).toBeNull();
    expect(readPersistentCache(keyFor('user-b'), TTL, isProfileLite)?.profile_image_url).toBe('old-image.jpg');
  });

  it('tål tomma eller saknade användar-id utan att kasta', () => {
    expect(() => invalidateCachedProfile(null)).not.toThrow();
    expect(() => invalidateCachedProfile(undefined)).not.toThrow();
    expect(() => invalidateCachedProfile('')).not.toThrow();
  });
});
