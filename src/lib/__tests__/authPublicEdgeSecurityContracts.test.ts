import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  approvedAppOrigin,
  fetchWithTimeout,
  genericPublicAuthResponse,
  isValidPublicSignupEmail,
  isValidPublicSignupPassword,
  readBoundedJson,
  runAuthBackgroundTask,
  sanitizeSignupMetadata,
  sha256Hex,
  waitForPublicAuthResponseFloor,
  withTimeout,
} from '../../../supabase/functions/_shared/public-auth-security';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const securityHelperPath = resolve(
  process.cwd(),
  'supabase/functions/_shared/public-auth-security.ts',
);

const resendLookupMigration = resolve(
  process.cwd(),
  'supabase/migrations/20260830221000_auth_resend_indexed_lookup.sql',
);

const signupConsentMigration = resolve(
  process.cwd(),
  'supabase/migrations/20260830222000_auth_signup_consent_fail_closed.sql',
);

const signupConsentEnforcementContract = resolve(
  process.cwd(),
  'supabase/contract-migrations/20260830224000_auth_signup_consent_enforcement.sql',
);

const confirmationCasMigration = resolve(
  process.cwd(),
  'supabase/migrations/20260830223000_email_confirmation_digest_cas.sql',
);

describe('public auth edge-function security contracts', () => {
  it('has one shared exact-origin and generic-response policy', () => {
    expect(existsSync(securityHelperPath)).toBe(true);
  });

  it.each([
    ['https://parium.se', 'https://parium.se'],
    ['https://www.parium.se/', 'https://www.parium.se'],
    ['https://parium-ab.lovable.app', 'https://parium-ab.lovable.app'],
    [
      'https://id-preview--09c4e686-17a9-467e-89b1-3cf832371d49.lovable.app/',
      'https://id-preview--09c4e686-17a9-467e-89b1-3cf832371d49.lovable.app',
    ],
  ])('accepts the exact approved HTTPS app origin %s', (candidate, expected) => {
    expect(approvedAppOrigin(candidate)).toBe(expected);
  });

  it.each([
    'http://parium.se',
    'https://parium.se.evil.example',
    'https://evilparium.se',
    'https://unapproved.lovable.app',
    'https://unapproved.lovable.dev',
    'https://user:password@parium.se',
    'https://parium.se:444',
    'https://parium.se/auth',
    'not-a-url',
  ])('fails closed to the canonical app for unapproved origin %s', (candidate) => {
    expect(approvedAppOrigin(candidate)).toBe('https://www.parium.se');
  });

  it('returns one stable public auth response without account-state fields', async () => {
    const response = genericPublicAuthResponse({ 'Access-Control-Allow-Origin': '*' });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(await response.json()).toEqual({
      success: true,
      message: 'Om adressen kan användas skickar vi nästa steg via e-post.',
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('parses small JSON bodies and rejects oversized streamed bodies before JSON work', async () => {
    const valid = await readBoundedJson<{ email: string }>(
      new Request('https://example.test', {
        method: 'POST',
        body: JSON.stringify({ email: 'person@example.com' }),
      }),
      1024,
    );
    expect(valid).toEqual({ email: 'person@example.com' });

    const declaredTooLarge = await readBoundedJson(
      new Request('https://example.test', {
        method: 'POST',
        headers: { 'Content-Length': '2048' },
        body: '{}',
      }),
      1024,
    );
    expect(declaredTooLarge).toBeNull();

    const streamedTooLarge = await readBoundedJson(
      new Request('https://example.test', {
        method: 'POST',
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('"' + 'x'.repeat(2048) + '"'));
            controller.close();
          },
        }),
        // Required by Node's Request implementation for stream bodies.
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
      1024,
    );
    expect(streamedTooLarge).toBeNull();
  });

  it('uses the bounded reader on every anonymous JSON auth endpoint', () => {
    for (const file of [
      'supabase/functions/custom-signup/index.ts',
      'supabase/functions/resend-confirmation/index.ts',
      'supabase/functions/send-reset-password/index.ts',
      'supabase/functions/confirm-email/index.ts',
    ]) {
      const code = source(file);
      expect(code).toContain('readBoundedJson');
      expect(code).not.toMatch(/await req\.(json|text)\(/);
    }
  });

  it('schedules work with EdgeRuntime.waitUntil without waiting for completion', async () => {
    let complete!: () => void;
    const operation = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const waitUntil = vi.fn();
    vi.stubGlobal('EdgeRuntime', { waitUntil });

    try {
      expect(runAuthBackgroundTask('public-auth-test', () => operation)).toBe(true);
      expect(waitUntil).toHaveBeenCalledTimes(1);
      expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
      complete();
      await operation;
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps a safe fallback when EdgeRuntime.waitUntil is unavailable', async () => {
    let ran = false;
    vi.stubGlobal('EdgeRuntime', undefined);

    try {
      expect(runAuthBackgroundTask('public-auth-fallback', async () => {
        ran = true;
      })).toBe(false);
      await Promise.resolve();
      expect(ran).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('holds validated public auth responses until the configured timing floor', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);

    await waitForPublicAuthResponseFloor(1_000, {
      minimumMs: 1_200,
      jitterMs: 200,
      now: () => 1_350,
      random: () => 0.5,
      sleep,
    });

    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(950);
  });

  it('bounds an external promise at the configured deadline', async () => {
    vi.useFakeTimers();
    try {
      const outcome = withTimeout(
        () => new Promise<never>(() => undefined),
        50,
        'mail delivery timed out',
      ).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(51);
      expect(await outcome).toMatchObject({ name: 'TimeoutError' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('hashes opaque confirmation capabilities deterministically before persistence', async () => {
    expect(await sha256Hex('confirmation-secret')).toBe(
      'ea5818893d23feb244d725edd50eb882200ab1a5abca4576858a917e00dde4e5',
    );
    expect(await sha256Hex('confirmation-secret')).not.toContain('confirmation-secret');
  });

  it('aborts a stalled outbound request at the configured deadline', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
        });
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      const outcome = fetchWithTimeout('https://example.test/mail', {}, 50)
        .catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(51);
      expect(await outcome).toMatchObject({ name: 'TimeoutError' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('does not expose email existence or role from the availability endpoint', () => {
    const code = source('supabase/functions/check-email-availability/index.ts');

    expect(code).not.toContain('auth_email_registered');
    expect(code).not.toContain('exists_flag');
    expect(code).not.toContain('user_role');
    expect(code).not.toMatch(/role\s*:/);
    expect(code).toContain('genericPublicAuthResponse');
    expect(code).not.toContain('createClient');
    expect(code).not.toContain('enforceRateLimit');
    expect(code).not.toContain('requestIp');
  });

  it('uses the managed auth email index through a service-role-only lookup instead of paging all auth users', () => {
    expect(existsSync(resendLookupMigration)).toBe(true);
    const migration = readFileSync(resendLookupMigration, 'utf8');
    const resend = source('supabase/functions/resend-confirmation/index.ts');

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.lookup_auth_email_for_resend');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('u.is_sso_user = false');
    expect(migration).toContain('u.email = lower(btrim(_email))');
    expect(migration).not.toContain('CREATE INDEX IF NOT EXISTS auth_users_email_normalized_lookup_idx');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.lookup_auth_email_for_resend(text) FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.lookup_auth_email_for_resend(text) TO service_role');
    expect(resend).not.toContain('findUserByEmail');
    expect(resend).not.toContain('listUsers');
    expect(resend).toContain('lookup_auth_email_for_resend');
  });

  it('returns the same outward resend response for missing, confirmed, and unconfirmed accounts', () => {
    const code = source('supabase/functions/resend-confirmation/index.ts');

    expect(code).not.toContain('alreadyConfirmed');
    expect(code).not.toContain('Ny bekräftelselänk skickad!');
    expect(code).not.toContain('E-postutskicket misslyckades');
    expect(code).not.toMatch(/JSON\.stringify\(\{\s*error:\s*message/);
    expect(code.match(/genericPublicAuthResponse\(corsHeaders\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(code).toContain('runAuthBackgroundTask');
    expect(code).not.toContain('if (rateLimitResponse) return rateLimitResponse');
  });

  it('persists each resend capability before delivery so concurrent links remain valid', () => {
    const code = source('supabase/functions/resend-confirmation/index.ts');
    const persistIndex = code.indexOf('issue_email_confirmation_token');
    const sendIndex = code.indexOf('const delivery = await withTimeout');

    expect(persistIndex).toBeGreaterThan(-1);
    expect(sendIndex).toBeGreaterThan(-1);
    expect(persistIndex).toBeLessThan(sendIndex);
    expect(code).toContain('delivery.sent');
    expect(code).not.toMatch(/from\(["']email_confirmations["']\)\s*\.delete/);
    expect(code).not.toContain('.upsert(');
  });

  it('never deletes or recreates an existing signup and keeps a new account after mail failure', () => {
    const code = source('supabase/functions/custom-signup/index.ts');

    expect(code).not.toContain('auth.admin.deleteUser');
    expect(code).not.toContain('Found existing unconfirmed signup, deleting first');
    expect(code).not.toContain('Deleting newly-created user due to email send failure');
    expect(code).not.toMatch(/from\(['"]profiles['"]\)\.delete/);
    expect(code).not.toMatch(/from\(['"]user_roles['"]\)\.delete/);
    expect(code).toContain('genericPublicAuthResponse');
    expect(code).toContain('sanitizeSignupMetadata');
    expect(code).not.toContain('user_metadata: data ?? {}');
  });

  it('marks admin-created public signups with a server-controlled app-metadata channel', () => {
    const code = source('supabase/functions/custom-signup/index.ts');

    expect(code).toContain('app_metadata: {');
    expect(code).toContain('parium_signup_channel: "custom-signup-v1"');
    expect(code).not.toMatch(/parium_signup_channel\s*:\s*metadata\./);
  });

  it('commits the account and token before responding and backgrounds only mail delivery', () => {
    const code = source('supabase/functions/custom-signup/index.ts');
    const handler = code.slice(code.indexOf('const handler'));
    const establish = code.slice(
      code.indexOf('async function establishSignup'),
      code.indexOf('async function deliverConfirmationMail'),
    );
    const delivery = code.slice(
      code.indexOf('async function deliverConfirmationMail'),
      code.indexOf('const handler'),
    );
    const background = handler.slice(handler.indexOf('runAuthBackgroundTask'));

    expect(code).toContain('async function establishSignup');
    expect(code).toContain('async function deliverConfirmationMail');
    expect(establish).toContain('await supabase.auth.admin.createUser');
    expect(establish).toContain('issue_email_confirmation_token');
    expect(establish.indexOf('auth.admin.createUser')).toBeLessThan(
      establish.indexOf('issue_email_confirmation_token'),
    );
    expect(establish).not.toContain('fetchWithTimeout');
    expect(delivery).toContain('fetchWithTimeout');
    expect(handler).toContain('const delivery = await establishSignup(');
    expect(handler).toContain('await waitForPublicAuthResponseFloor(responseStartedAt)');
    expect(handler).toContain('runAuthBackgroundTask("custom-signup-mail"');
    expect(handler).toContain('() => deliverConfirmationMail(delivery)');
    expect(background).not.toContain('password');
    expect(code).not.toContain('auth_email_registered');
  });

  it('keeps custom confirmation capabilities out of HTTP request queries', () => {
    const signup = source('supabase/functions/custom-signup/index.ts');
    const resend = source('supabase/functions/resend-confirmation/index.ts');

    expect(signup).toContain('/email-confirm#confirm=${confirmationToken}');
    expect(resend).toContain('/email-confirm#confirm=${confirmationToken}');
    expect(signup).not.toContain('/email-confirm?confirm=${confirmationToken}');
    expect(resend).not.toContain('/email-confirm?confirm=${confirmationToken}');
    expect(resend).toContain('https://www.parium.se/email-confirm#confirm=${confirmationToken}');
  });

  it('uses an expand-compatible digest pipeline with lookup, auth update, and final CAS', () => {
    const signup = source('supabase/functions/custom-signup/index.ts');
    const resend = source('supabase/functions/resend-confirmation/index.ts');
    const confirm = source('supabase/functions/confirm-email/index.ts');

    expect(existsSync(confirmationCasMigration)).toBe(true);
    const migration = readFileSync(confirmationCasMigration, 'utf8');

    expect(signup).toContain('sha256Hex(confirmationToken)');
    expect(resend).toContain('sha256Hex(confirmationToken)');
    expect(confirm).toContain('sha256Hex(token)');
    expect(signup).toContain('issue_email_confirmation_token');
    expect(resend).toContain('issue_email_confirmation_token');
    expect(confirm).toContain('lookup_email_confirmation_token');
    expect(confirm).toContain('finalize_email_confirmation_token');
    expect(confirm).not.toContain('consume_email_confirmation_token');
    expect(confirm).not.toContain(".eq('token', token)");
    expect(confirm).not.toContain('.select(\'*\')');
    expect(confirm).not.toMatch(/email\s*:\s*confirmation/);

    const lookupIndex = confirm.indexOf('lookup_email_confirmation_token');
    const authUpdateIndex = confirm.indexOf('updateUserById');
    const finalizeIndex = confirm.indexOf('finalize_email_confirmation_token');
    expect(lookupIndex).toBeGreaterThan(-1);
    expect(authUpdateIndex).toBeGreaterThan(lookupIndex);
    expect(finalizeIndex).toBeGreaterThan(authUpdateIndex);

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS token_digest text');
    expect(migration).not.toContain('ALTER COLUMN token TYPE text');
    expect(migration).toContain("encode(extensions.digest(token::text, 'sha256'), 'hex')");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.email_confirmation_tokens');
    expect(migration).toContain('JOIN auth.users AS auth_user ON auth_user.id = ec.user_id');
    expect(migration).toContain('email_confirmation_tokens_expires_at_idx');
    expect(migration).toContain('email_confirmations_unconfirmed_expires_at_idx');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.issue_email_confirmation_token');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.lookup_email_confirmation_token');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.finalize_email_confirmation_token');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.cleanup_expired_email_confirmation_capabilities');
    expect(migration).toMatch(/token_digest\s*=\s*lower\(btrim\(_token_digest\)\)/);
    expect(migration).toMatch(/token::text\s*=\s*_raw_token::text/);
    expect(migration).not.toContain('DROP FUNCTION IF EXISTS public.validate_confirmation_token');
    expect(migration).not.toContain('DROP CONSTRAINT email_confirmations_user_id');
    for (const signature of [
      'issue_email_confirmation_token(uuid,text,uuid,text,timestamp with time zone)',
      'lookup_email_confirmation_token(text,uuid)',
      'finalize_email_confirmation_token(uuid,text,uuid)',
      'cleanup_expired_email_confirmation_capabilities(integer)',
    ]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated`);
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role`);
    }
  });

  it('cleans expired confirmation capabilities without treating expiry as account deletion proof', () => {
    const cleanup = source('supabase/functions/cleanup-expired-confirmations/index.ts');

    expect(cleanup).toContain("rpc('cleanup_expired_email_confirmation_capabilities'");
    expect(cleanup).toContain('MAX_CLEANUP_BATCHES = 5');
    expect(cleanup).toContain('CLEANUP_TIME_BUDGET_MS');
    expect(cleanup).not.toMatch(/\.from\(['"]email_confirmations['"]\)/);
    expect(cleanup).not.toMatch(/\.from\(['"]email_confirmation_tokens['"]\)/);
    expect(cleanup).not.toContain('purgeUserData');
    expect(cleanup).not.toContain('auth.admin.deleteUser');
    expect(cleanup).not.toMatch(
      /from\('email_confirmation_tokens'\)[\s\S]*select\('user_id'\)[\s\S]*purgeUserData/,
    );
  });

  it('fails the public confirmation endpoint closed without leaking account state or PII', () => {
    const confirm = source('supabase/functions/confirm-email/index.ts');

    expect(confirm).toContain('req.method !== "POST"');
    expect(confirm).toContain('Cache-Control": "no-store"');
    expect(confirm).toContain('genericConfirmationResponse');
    expect(confirm).toContain('processed: processed && status === 200');
    expect(confirm).toContain('genericConfirmationResponse(true)');
    expect(confirm).not.toMatch(/success:\s*status\s*===\s*200/);
    expect(confirm).not.toContain('alreadyConfirmed');
    expect(confirm).not.toContain('confirmation.email');
    expect(confirm).not.toMatch(/error\.message/);
  });

  it('whitelists signup metadata and fails closed for invalid role or consent', () => {
    const accepted = sanitizeSignupMetadata({
      role: 'employer',
      first_name: '  Ada  ',
      last_name: 'Lovelace',
      company_name: 'Analytical Engines',
      industry: 'Technology',
      address: '1 Engine Way',
      website: 'https://example.com/',
      employee_count: '11-50',
      terms_accepted_at: new Date().toISOString(),
      policy_version: '2026-01',
      dpa_version: '2026-01',
      injected_admin: true,
    });

    expect(accepted).toMatchObject({
      role: 'employer',
      first_name: 'Ada',
      last_name: 'Lovelace',
      company_name: 'Analytical Engines',
      policy_version: '2026-01',
      dpa_version: '2026-01',
    });
    expect(accepted).not.toHaveProperty('injected_admin');
    expect(sanitizeSignupMetadata({
      role: 'super_admin',
      first_name: 'Ada',
      last_name: 'Lovelace',
      terms_accepted_at: new Date().toISOString(),
      policy_version: '2026-01',
      dpa_version: '2026-01',
    })).toBeNull();
    expect(sanitizeSignupMetadata({
      role: 'job_seeker',
      first_name: 'Ada',
      last_name: 'Lovelace',
      policy_version: '2026-01',
      dpa_version: '2026-01',
    })).toBeNull();
    expect(sanitizeSignupMetadata({
      role: 'employer',
      first_name: 'Ada',
      last_name: 'Lovelace',
      company_name: 'Analytical Engines',
      terms_accepted_at: new Date().toISOString(),
      policy_version: 'attacker-supplied',
      dpa_version: 'attacker-supplied',
    })).toBeNull();
  });

  it('enforces the public signup credential contract at the edge boundary', () => {
    expect(isValidPublicSignupEmail('person@example.com')).toBe(true);
    expect(isValidPublicSignupEmail(`${'a'.repeat(242)}@example.com`)).toBe(true);
    expect(isValidPublicSignupEmail(`${'a'.repeat(243)}@example.com`)).toBe(false);
    expect(isValidPublicSignupEmail('not-an-email')).toBe(false);
    expect(isValidPublicSignupEmail('person @example.com')).toBe(false);

    expect(isValidPublicSignupPassword('12345678')).toBe(true);
    expect(isValidPublicSignupPassword('x'.repeat(128))).toBe(true);
    expect(isValidPublicSignupPassword('1234567')).toBe(false);
    expect(isValidPublicSignupPassword('x'.repeat(129))).toBe(false);
    expect(isValidPublicSignupPassword(null)).toBe(false);

    const signup = source('supabase/functions/custom-signup/index.ts');
    expect(signup).toContain('isValidPublicSignupEmail');
    expect(signup).toContain('isValidPublicSignupPassword');
  });

  it('mirrors UI metadata lengths, types, required role fields, and http(s) websites', () => {
    const base = {
      role: 'employer',
      first_name: 'Ada',
      last_name: 'Lovelace',
      company_name: 'Analytical Engines',
      industry: 'Technology',
      address: '1 Engine Way',
      website: 'https://example.com/',
      employee_count: '11-50 anställda',
      terms_accepted_at: new Date(Date.now() - 60_000).toISOString(),
      policy_version: '2026-01',
      dpa_version: '2026-01',
    };

    expect(sanitizeSignupMetadata({ ...base, industry: 'i'.repeat(120) })).not.toBeNull();
    expect(sanitizeSignupMetadata({ ...base, industry: 'i'.repeat(121) })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, address: 'a'.repeat(160) })).not.toBeNull();
    expect(sanitizeSignupMetadata({ ...base, address: 'a'.repeat(161) })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, website: 'https://example.com/' })).not.toBeNull();
    expect(sanitizeSignupMetadata({ ...base, website: 'javascript:alert(1)' })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, website: 'https://user:secret@example.com' })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, website: 'https://127.0.0.1' })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, website: 'https://192.168.1.20' })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, website: 'https://service.internal' })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, website: 'https://company.local' })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, website: { href: 'https://example.com' } })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, company_description: 'd'.repeat(3000) })).not.toBeNull();
    expect(sanitizeSignupMetadata({ ...base, company_description: 'd'.repeat(3001) })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, company_name: undefined })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, industry: undefined })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, address: undefined })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, website: undefined })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, employee_count: undefined })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, employee_count: '1-1000000' })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, industry: 12345 })).toBeNull();
    expect(sanitizeSignupMetadata({
      role: 'job_seeker',
      first_name: 'Ada',
      last_name: 'Lovelace',
      terms_accepted_at: new Date().toISOString(),
      policy_version: '2026-01',
    })).toBeNull();
  });

  it('validates and canonicalizes the required Swedish signup phone at the edge', () => {
    const base = {
      role: 'job_seeker',
      first_name: 'Ada',
      last_name: 'Lovelace',
      terms_accepted_at: new Date().toISOString(),
      policy_version: '2026-01',
    };

    expect(sanitizeSignupMetadata({ ...base, phone: '070-123 45 67' })?.phone)
      .toBe('+46701234567');
    expect(sanitizeSignupMetadata({ ...base, phone: '0046 73 123 45 67' })?.phone)
      .toBe('+46731234567');
    expect(sanitizeSignupMetadata({ ...base, phone: '+46 76 123 45 67' })?.phone)
      .toBe('+46761234567');
    expect(sanitizeSignupMetadata({ ...base, phone: '+46 8 123 45 67' })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, phone: '070123' })).toBeNull();
    expect(sanitizeSignupMetadata({ ...base, phone: 'not-a-phone' })).toBeNull();
  });

  it('records server receipt time instead of trusting the submitted consent timestamp', () => {
    const submitted = new Date(Date.now() - 60 * 60_000).toISOString();
    const before = Date.now();
    const accepted = sanitizeSignupMetadata({
      role: 'job_seeker',
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '+46700000000',
      terms_accepted_at: submitted,
      policy_version: '2026-01',
    });
    const after = Date.now();

    expect(accepted).not.toBeNull();
    expect(accepted?.terms_accepted_at).not.toBe(submitted);
    expect(Date.parse(accepted!.terms_accepted_at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(accepted!.terms_accepted_at)).toBeLessThanOrEqual(after);
  });

  it('keeps signup metadata role-specific instead of accepting cross-role fields', () => {
    const jobSeeker = sanitizeSignupMetadata({
      role: 'job_seeker',
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '+46700000000',
      company_name: 'Injected employer company',
      dpa_version: '2026-01',
      terms_accepted_at: new Date().toISOString(),
      policy_version: '2026-01',
    });
    const employer = sanitizeSignupMetadata({
      role: 'employer',
      first_name: 'Grace',
      last_name: 'Hopper',
      phone: '+46700000000',
      company_name: 'Compiler AB',
      industry: 'Technology',
      address: '1 Compiler Way',
      website: 'https://example.com/',
      employee_count: '11-50',
      terms_accepted_at: new Date().toISOString(),
      policy_version: '2026-01',
      dpa_version: '2026-01',
    });

    expect(jobSeeker).not.toHaveProperty('company_name');
    expect(jobSeeker).not.toHaveProperty('dpa_version');
    expect(employer).not.toHaveProperty('phone');
  });

  it('makes the signup database trigger fail closed without clearing unsubscribe or bounce suppression', () => {
    expect(existsSync(signupConsentMigration)).toBe(true);
    expect(existsSync(signupConsentEnforcementContract)).toBe(true);
    const prerequisites = readFileSync(signupConsentMigration, 'utf8');
    const migration = readFileSync(signupConsentEnforcementContract, 'utf8');

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.handle_new_user()');
    expect(migration).toContain("v_signup_channel <> 'custom-signup-v1'");
    expect(migration).toContain('v_custom_signup_edge_commit text := NULL');
    expect(migration).toContain('v_staging_signup_verified_at timestamptz := NULL');
    expect(migration).toContain('Immediately after apply');
    expect(migration).toContain('direct /auth/v1/signup is denied');
    expect(migration).toContain("v_role NOT IN ('job_seeker', 'employer')");
    expect(migration).toContain("NULLIF(btrim(new.raw_user_meta_data ->> 'terms_accepted_at'), '') IS NULL");
    expect(migration).toContain("NULLIF(btrim(new.raw_user_meta_data ->> 'policy_version'), '') IS NULL");
    expect(migration).toContain("v_policy_version <> '2026-01'");
    expect(migration).toContain("v_dpa_version <> '2026-01'");
    expect(prerequisites).not.toContain('CREATE OR REPLACE FUNCTION public.handle_new_user()');
    expect(prerequisites).toContain('CREATE INDEX IF NOT EXISTS suppressed_emails_normalized_email_idx');
    expect(prerequisites).toContain('ON public.suppressed_emails (lower(email))');
    expect(migration).toContain("reason IN ('account_deleted', 'account_deleted_inactive')");
    expect(migration).not.toMatch(/reason IN \([^)]*'unsubscribe'/);
    expect(migration).not.toMatch(/reason IN \([^)]*'bounce'/);
  });

  it('does not reveal reset account state or mail-delivery state', () => {
    const code = source('supabase/functions/send-reset-password/index.ts');

    expect(code).not.toContain('E-postutskicket misslyckades');
    expect(code).not.toMatch(/JSON\.stringify\(\{\s*success:\s*true,\s*data/);
    expect(code).not.toMatch(/JSON\.stringify\(\{\s*error:\s*message/);
    expect(code.match(/genericPublicAuthResponse\(corsHeaders\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(code).toContain('runAuthBackgroundTask');
    expect(code).not.toContain('if (rateLimitResponse) return rateLimitResponse');
  });

  it('bounds resend, reset, and internal confirmation mail delivery and handles suppression explicitly', () => {
    const resend = source('supabase/functions/resend-confirmation/index.ts');
    const reset = source('supabase/functions/send-reset-password/index.ts');
    const confirmation = source('supabase/functions/send-confirmation-email/index.ts');
    const signup = source('supabase/functions/custom-signup/index.ts');

    for (const code of [resend, reset, confirmation]) {
      expect(code).toContain('withTimeout');
      expect(code).toMatch(/\.sent/);
    }
    expect(signup).toContain('delivered === true');
  });

  it('uses a server-owned reset origin and retires the bearer recovery redirect', () => {
    const reset = source('supabase/functions/send-reset-password/index.ts');
    const recovery = source('supabase/functions/redirect-recovery/index.ts');
    const signup = source('supabase/functions/custom-signup/index.ts');

    expect(reset).toContain('resolveResetAppOrigin');
    expect(reset).not.toContain('approvedAppOrigin');
    expect(reset).not.toContain('ALLOWED_ORIGINS');
    expect(recovery).toContain('status: 410');
    expect(recovery).not.toContain('hardenRecoveryRedirectTarget');
    expect(recovery).not.toContain('atob(');
    expect(recovery).not.toContain('ALLOWED_SUFFIXES');
    expect(recovery).not.toMatch(/u\.protocol !== "https:" && u\.protocol !== "http:"/);
    expect(signup).toContain('approvedAppOrigin');
    expect(signup).not.toContain('redirectEnv.startsWith("http")');
    expect(signup).toContain('fetchWithTimeout');
  });

  it('marks every recovery redirect response as non-cacheable and non-referring', () => {
    const recovery = source('supabase/functions/redirect-recovery/index.ts');

    expect(recovery).toContain('Cache-Control');
    expect(recovery).toContain('no-store');
    expect(recovery).toContain('Pragma');
    expect(recovery).toContain('no-cache');
    expect(recovery).toContain('Referrer-Policy');
    expect(recovery).toContain('no-referrer');
    expect(recovery).toContain('status: 410');
    expect(recovery).not.toContain('hardenRecoveryRedirectTarget');
  });

  it('never logs public auth email addresses or tokens in the changed edge functions', () => {
    const paths = [
      'supabase/functions/custom-signup/index.ts',
      'supabase/functions/resend-confirmation/index.ts',
      'supabase/functions/send-reset-password/index.ts',
      'supabase/functions/redirect-recovery/index.ts',
    ];

    for (const path of paths) {
      const code = source(path);
      expect(code).not.toMatch(
        /console\.(?:log|warn|error)\([^;]*(?:,\s*(?:normalizedEmail|confirmationToken|resetUrl|decodedUrl)\b|\{\s*(?:normalizedEmail|confirmationToken|resetUrl|decodedUrl)\b)/,
      );
    }

    const signup = source('supabase/functions/custom-signup/index.ts');
    const confirmation = source('supabase/functions/send-confirmation-email/index.ts');
    expect(signup).not.toContain('console.error("Error in custom-signup", error)');
    expect(confirmation).not.toMatch(
      /idempotencyKey\s*=\s*`[^`]*\$\{email\}[^`]*\$\{confirmation_url/,
    );
    expect(confirmation).toContain('crypto.subtle.digest');
  });
});
