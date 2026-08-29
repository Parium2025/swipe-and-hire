import { describe, it, expect, beforeEach } from 'vitest';
import {
  readCachedStats,
  writeCachedStat,
  JOBSEEKER_STATS_CACHE_PREFIX,
  LEGACY_JOBSEEKER_STATS_KEY,
} from '@/lib/jobseekerStatsCache';

const USER_A = 'user-a';
const USER_B = 'user-b';

describe('jobseekerStatsCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('isolerar cachen per användare', () => {
    writeCachedStat(USER_A, 'applications', 5);
    expect(readCachedStats(USER_A)).toEqual({ applications: 5 });
    expect(readCachedStats(USER_B)).toEqual({});
  });

  it('skriver till användarbunden nyckel, aldrig till den globala', () => {
    writeCachedStat(USER_A, 'applications', 5);
    expect(localStorage.getItem(`${JOBSEEKER_STATS_CACHE_PREFIX}${USER_A}`)).toBeTruthy();
    expect(localStorage.getItem(LEGACY_JOBSEEKER_STATS_KEY)).toBeNull();
  });

  it('rensar den gamla globala nyckeln utan att migrera värden', () => {
    localStorage.setItem(LEGACY_JOBSEEKER_STATS_KEY, JSON.stringify({ applications: 99 }));
    expect(readCachedStats(USER_A)).toEqual({});
    expect(localStorage.getItem(LEGACY_JOBSEEKER_STATS_KEY)).toBeNull();
  });

  it('är en no-op utan användare', () => {
    writeCachedStat(undefined, 'applications', 5);
    expect(readCachedStats(undefined)).toEqual({});
    expect(localStorage.length).toBe(0);
  });

  it('hanterar korrupt JSON utan att kasta', () => {
    localStorage.setItem(`${JOBSEEKER_STATS_CACHE_PREFIX}${USER_A}`, '{ trasig');
    expect(readCachedStats(USER_A)).toEqual({});
  });
});
