/**
 * Pure, side-effect-free safety validator for the load-test harness.
 *
 * Fail-closed rules:
 * - the ACTUAL Supabase URL that traffic will hit must be validated (never a label)
 * - an expected origin must be provided explicitly
 * - production may only be targeted with an explicit opt-in flag
 * - there is no "small run is safe" exception
 */

const PRODUCTION_ORIGINS = new Set([
  'https://jrjaegapuujushsiofoi.supabase.co',
]);

const PRODUCTION_HOST_PATTERNS = [/(^|\.)parium\.se$/i];

export function normalizeOrigin(raw: string | undefined | null): string {
  const value = (raw ?? '').trim();
  if (!value) {
    throw new Error('Invalid Supabase URL: empty value.');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid Supabase URL: "${value}" is not a valid absolute URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid Supabase URL: "${value}" must use http(s).`);
  }
  if (!parsed.hostname) {
    throw new Error(`Invalid Supabase URL: "${value}" has no host.`);
  }
  return `${parsed.protocol}//${parsed.host.toLowerCase()}`;
}

export function isProductionOrigin(origin: string): boolean {
  if (PRODUCTION_ORIGINS.has(origin)) return true;
  const host = new URL(origin).hostname;
  return PRODUCTION_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

export type LoadTestTargetCheck = {
  actualUrl: string | undefined | null;
  expectedUrl: string | undefined | null;
  allowProduction: boolean;
  virtualUsers?: number;
};

export type LoadTestTargetResult = {
  origin: string;
  isProduction: boolean;
};

export function assertLoadTestTargetAllowed(input: LoadTestTargetCheck): LoadTestTargetResult {
  if (!(input.expectedUrl ?? '').trim()) {
    throw new Error(
      'PARIUM_LOAD_TEST_EXPECTED_SUPABASE_URL is required. Set it to the exact origin you intend to load test.'
    );
  }
  if (!(input.actualUrl ?? '').trim()) {
    throw new Error('Invalid Supabase URL: no actual Supabase URL configured for the load test.');
  }

  const actualOrigin = normalizeOrigin(input.actualUrl);
  const expectedOrigin = normalizeOrigin(input.expectedUrl);

  if (actualOrigin !== expectedOrigin) {
    throw new Error(
      `Refusing to run: target mismatch. Actual Supabase origin ${actualOrigin} does not match expected ${expectedOrigin}.`
    );
  }

  const production = isProductionOrigin(actualOrigin);
  if (production && !input.allowProduction) {
    throw new Error(
      `Refusing to run against production origin ${actualOrigin}. Set PARIUM_LOAD_TEST_ALLOW_PRODUCTION=true to explicitly opt in.`
    );
  }

  return { origin: actualOrigin, isProduction: production };
}

export type LoadTestEnv = Record<string, string | undefined>;

/**
 * Resolves which Supabase URL/anon key the load test will actually use.
 * Explicit runtime variables (SUPABASE_URL / SUPABASE_ANON_KEY) always win
 * over the VITE_* build-time fallbacks, so a staging run following the docs
 * cannot silently inherit production VITE_ values from .env.
 */
export function resolveLoadTestConnection(environment: LoadTestEnv): { url: string; anonKey: string } {
  const pick = (...names: string[]): string => {
    for (const name of names) {
      const value = (environment[name] ?? '').trim();
      if (value) return value;
    }
    return '';
  };
  return {
    url: pick('SUPABASE_URL', 'VITE_SUPABASE_URL'),
    anonKey: pick('SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'),
  };
}
