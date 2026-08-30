import { describe, it, expect } from 'vitest';
import { assertLoadTestTargetAllowed, normalizeOrigin, resolveLoadTestConnection } from '../../scripts/load-test-safety';

const PROD = 'https://jrjaegapuujushsiofoi.supabase.co';
const STAGING = 'https://staging-project.supabase.co';

describe('load test safety validator', () => {
  it('throws when actual is production but expected is staging, even with allowProduction=true', () => {
    expect(() =>
      assertLoadTestTargetAllowed({
        actualUrl: PROD,
        expectedUrl: STAGING,
        allowProduction: true,
      })
    ).toThrow(/mismatch/i);
  });

  it('throws when actual matches expected production but allowProduction=false', () => {
    expect(() =>
      assertLoadTestTargetAllowed({
        actualUrl: PROD,
        expectedUrl: PROD,
        allowProduction: false,
        virtualUsers: 1,
      })
    ).toThrow(/PARIUM_LOAD_TEST_ALLOW_PRODUCTION/);
  });

  it('passes for matching staging without production flag', () => {
    const result = assertLoadTestTargetAllowed({
      actualUrl: STAGING + '/',
      expectedUrl: STAGING,
      allowProduction: false,
      virtualUsers: 500,
    });
    expect(result.origin).toBe(STAGING);
    expect(result.isProduction).toBe(false);
  });

  it('passes for matching production only with explicit opt-in', () => {
    const result = assertLoadTestTargetAllowed({
      actualUrl: PROD,
      expectedUrl: PROD + '/',
      allowProduction: true,
    });
    expect(result.origin).toBe(PROD);
    expect(result.isProduction).toBe(true);
  });

  it('fails closed when expected url is missing', () => {
    expect(() =>
      assertLoadTestTargetAllowed({ actualUrl: STAGING, expectedUrl: '', allowProduction: true })
    ).toThrow(/PARIUM_LOAD_TEST_EXPECTED_SUPABASE_URL/);
  });

  it('fails closed on malformed urls', () => {
    expect(() =>
      assertLoadTestTargetAllowed({ actualUrl: 'not a url', expectedUrl: STAGING, allowProduction: true })
    ).toThrow(/invalid/i);
    expect(() =>
      assertLoadTestTargetAllowed({ actualUrl: STAGING, expectedUrl: 'nope://', allowProduction: true })
    ).toThrow(/invalid/i);
  });

  it('normalizes origin and trailing slashes safely', () => {
    expect(normalizeOrigin('https://Example.SUPABASE.co/rest/v1/')).toBe('https://example.supabase.co');
    expect(() => normalizeOrigin('')).toThrow(/invalid/i);
  });
});

describe('resolveLoadTestConnection', () => {
  it('prefers explicit SUPABASE_URL over VITE_ fallback values', () => {
    const result = resolveLoadTestConnection({
      SUPABASE_URL: STAGING,
      VITE_SUPABASE_URL: PROD,
      SUPABASE_ANON_KEY: 'staging-anon',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'prod-anon',
      VITE_SUPABASE_ANON_KEY: 'prod-anon-legacy',
    });
    expect(result.url).toBe(STAGING);
    expect(result.anonKey).toBe('staging-anon');
  });

  it('falls back to VITE_ values only when explicit vars are missing', () => {
    const result = resolveLoadTestConnection({
      VITE_SUPABASE_URL: STAGING,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'anon',
    });
    expect(result.url).toBe(STAGING);
    expect(result.anonKey).toBe('anon');
    const legacy = resolveLoadTestConnection({
      VITE_SUPABASE_URL: STAGING,
      VITE_SUPABASE_ANON_KEY: 'legacy-anon',
    });
    expect(legacy.anonKey).toBe('legacy-anon');
  });

  it('treats blank explicit vars as missing so fallbacks apply', () => {
    const result = resolveLoadTestConnection({
      SUPABASE_URL: '   ',
      VITE_SUPABASE_URL: STAGING,
      SUPABASE_ANON_KEY: '',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'anon',
    });
    expect(result.url).toBe(STAGING);
    expect(result.anonKey).toBe('anon');
  });
});
