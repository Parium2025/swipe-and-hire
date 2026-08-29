import { describe, it, expect, beforeEach } from 'vitest';
import {
  readCachedStats,
  writeCachedStat,
  JOBSEEKER_STATS_CACHE_PREFIX,
  LEGACY_JOBSEEKER_STATS_KEY,
} from '@/lib/jobseekerStatsCache';

/**
 * RED-steg Produktionshärdning 1 — riktade härdningstester för
 * jobbsökarens statistikcache (användarisolering, nyckelformat,
 * legacy-rensning, no-op utan användare, korrupt data).
 */

const USER_A = 'user-a';
const USER_B = 'user-b';

describe('jobseekerStatsCache — härdning', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. isolerar statistiken strikt per user-id på delad enhet', () => {
    writeCachedStat(USER_A, 'applications_count', 9);
    expect(readCachedStats(USER_B)).toEqual({});
    // Inloggning av USER_A visar egna siffror
    expect(readCachedStats(USER_A)).toEqual({ applications_count: 9 });
  });

  it('2. använder nyckelformatet parium-jobseeker-stats:v2:<userId>', () => {
    expect(JOBSEEKER_STATS_CACHE_PREFIX).toBe('parium-jobseeker-stats:v2:');
    writeCachedStat(USER_A, 'saved_jobs_count', 2);
    expect(localStorage.getItem(`parium-jobseeker-stats:v2:${USER_A}`)).not.toBeNull();
  });

  it('3. tar bort exakt legacy-nyckeln parium-jobseeker-stats utan migrering', () => {
    expect(LEGACY_JOBSEEKER_STATS_KEY).toBe('parium-jobseeker-stats');
    localStorage.setItem(LEGACY_JOBSEEKER_STATS_KEY, JSON.stringify({ applications_count: 42 }));
    // Värdet får ALDRIG migreras till något konto
    expect(readCachedStats(USER_A)).toEqual({});
    expect(localStorage.getItem(LEGACY_JOBSEEKER_STATS_KEY)).toBeNull();
  });

  it('4. är tom läsning och no-op-skrivning utan user-id', () => {
    writeCachedStat(null, 'applications_count', 5);
    writeCachedStat(undefined, 'saved_jobs_count', 3);
    expect(readCachedStats(null)).toEqual({});
    expect(readCachedStats(undefined)).toEqual({});
    expect(localStorage.length).toBe(0);
  });

  it('5. korrupt JSON ger tomt resultat och rensas', () => {
    const key = `${JOBSEEKER_STATS_CACHE_PREFIX}${USER_A}`;
    localStorage.setItem(key, '{ trasig json');
    expect(readCachedStats(USER_A)).toEqual({});
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('5b. ogiltig struktur (array/primitiv) ger tomt resultat och rensas', () => {
    const key = `${JOBSEEKER_STATS_CACHE_PREFIX}${USER_A}`;
    localStorage.setItem(key, '[1,2,3]');
    expect(readCachedStats(USER_A)).toEqual({});
    expect(localStorage.getItem(key)).toBeNull();
  });
});
