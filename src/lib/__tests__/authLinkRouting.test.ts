import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildExternalConfirmationUrl,
  getAuthRedirectTarget,
  sanitizeAuthNext,
  sanitizeAuthReturnTo,
} from '@/lib/authLinkRouting';

const hexToken = 'a'.repeat(64);

describe('auth-link routing', () => {
  it('encodes explicit cross-browser confirmation handoff in a fragment, never a query', () => {
    const token = 'secret&next=https://evil.example/#value';
    const target = buildExternalConfirmationUrl('https://www.parium.se', token);
    const parsed = new URL(target);

    expect(parsed.pathname).toBe('/confirm');
    expect(parsed.search).toBe('');
    expect(new URLSearchParams(parsed.hash.slice(1)).get('confirm')).toBe(token);
    expect(target).not.toContain('?confirm=');
  });

  it('never classifies a 64-hex team-invite token as a legacy unsubscribe token', () => {
    expect(
      getAuthRedirectTarget(`https://www.parium.se/team-invite?token=${hexToken}`),
    ).toBeNull();
  });

  it('leaves the confirmation page own missing-token error on its route', () => {
    expect(
      getAuthRedirectTarget('https://www.parium.se/email-confirm?error=missing_token'),
    ).toBeNull();
  });

  it('keeps the supported legacy root token redirect', () => {
    expect(
      getAuthRedirectTarget(`https://www.parium.se/?token=${hexToken}`),
    ).toBe('https://www.parium.se/unsubscribe');
  });

  it.each([
    `https://www.parium.se/team-invite?token=${hexToken}&type=recovery`,
    `https://www.parium.se/team-invite?token=${hexToken}&reset=false`,
    `https://www.parium.se/unsubscribe?token=${hexToken}&type=recovery`,
    `https://www.parium.se/unsubscribe?token=${hexToken}&reset=false`,
  ])('never lets public auth-looking state capture a route-owned query token: %s', (href) => {
    expect(getAuthRedirectTarget(href)).toBeNull();
  });

  it('moves query recovery credentials into the fragment when forwarding to auth', () => {
    const target = getAuthRedirectTarget(
      'https://www.parium.se/home?access_token=access-secret&refresh_token=refresh-secret&type=recovery',
    );

    expect(target).not.toBeNull();
    const parsed = new URL(target!);
    expect(parsed.pathname).toBe('/auth');
    expect(parsed.searchParams.get('access_token')).toBeNull();
    expect(parsed.searchParams.get('refresh_token')).toBeNull();
    expect(parsed.searchParams.get('type')).toBe('recovery');

    const hash = new URLSearchParams(parsed.hash.slice(1));
    expect(hash.get('access_token')).toBe('access-secret');
    expect(hash.get('refresh_token')).toBe('refresh-secret');
    expect(hash.get('type')).toBe('recovery');
  });

  it('scrubs complete query recovery credentials already on auth without redirecting twice', () => {
    const target = getAuthRedirectTarget(
      'https://www.parium.se/auth?access_token=access-secret&refresh_token=refresh-secret&type=recovery',
    );

    expect(target).not.toBeNull();
    const parsed = new URL(target!);
    expect(parsed.pathname).toBe('/auth');
    expect(parsed.searchParams.get('access_token')).toBeNull();
    expect(parsed.searchParams.get('refresh_token')).toBeNull();
    expect(parsed.searchParams.get('type')).toBe('recovery');

    const hash = new URLSearchParams(parsed.hash.slice(1));
    expect(hash.get('access_token')).toBe('access-secret');
    expect(hash.get('refresh_token')).toBe('refresh-secret');
    expect(getAuthRedirectTarget(target!)).toBeNull();
  });

  it('moves an auth query token_hash into the fragment without redirecting twice', () => {
    const target = getAuthRedirectTarget(
      'https://www.parium.se/auth?token_hash=otp-secret&type=recovery&reset=true',
    );

    expect(target).not.toBeNull();
    const parsed = new URL(target!);
    expect(parsed.searchParams.get('token_hash')).toBeNull();
    expect(parsed.searchParams.get('reset')).toBe('true');
    expect(new URLSearchParams(parsed.hash.slice(1)).get('token_hash')).toBe('otp-secret');
    expect(getAuthRedirectTarget(target!)).toBeNull();
  });

  it('preserves fragment recovery credentials without exposing them in the query', () => {
    const target = getAuthRedirectTarget(
      'https://www.parium.se/home#access_token=hash-access&refresh_token=hash-refresh&type=recovery',
    );

    expect(target).not.toBeNull();
    const parsed = new URL(target!);
    expect(parsed.searchParams.get('access_token')).toBeNull();
    expect(parsed.searchParams.get('refresh_token')).toBeNull();

    const hash = new URLSearchParams(parsed.hash.slice(1));
    expect(hash.get('access_token')).toBe('hash-access');
    expect(hash.get('refresh_token')).toBe('hash-refresh');
    expect(hash.get('type')).toBe('recovery');
  });

  it('preserves the allowlisted implicit-grant fields required by the Supabase client', () => {
    const target = getAuthRedirectTarget(
      'https://www.parium.se/home?access_token=access-secret&refresh_token=refresh-secret'
      + '&expires_in=3600&expires_at=2000000000&token_type=bearer'
      + '&provider_token=provider-secret&provider_refresh_token=provider-refresh&type=signup',
    );

    expect(target).not.toBeNull();
    const parsed = new URL(target!);
    const hash = new URLSearchParams(parsed.hash.slice(1));
    expect(hash.get('expires_in')).toBe('3600');
    expect(hash.get('expires_at')).toBe('2000000000');
    expect(hash.get('token_type')).toBe('bearer');
    expect(hash.get('provider_token')).toBe('provider-secret');
    expect(hash.get('provider_refresh_token')).toBe('provider-refresh');
    for (const key of ['access_token', 'refresh_token', 'provider_token', 'provider_refresh_token']) {
      expect(parsed.searchParams.has(key)).toBe(false);
    }
  });

  it('scrubs an incomplete access/refresh credential pair fail-closed', () => {
    const target = getAuthRedirectTarget(
      'https://www.parium.se/home?access_token=only-one-half&type=recovery',
    );

    expect(target).not.toBeNull();
    const parsed = new URL(target!);
    expect(parsed.pathname).toBe('/auth');
    expect(parsed.searchParams.get('access_token')).toBeNull();
    expect(parsed.searchParams.get('refresh_token')).toBeNull();
    expect(parsed.searchParams.get('error_code')).toBe('invalid_auth_link');
    expect(parsed.hash).toBe('');
    expect(getAuthRedirectTarget(target!)).toBeNull();
  });

  it.each([
    'https://www.parium.se/auth?refresh_token=only-one-half&type=recovery',
    'https://www.parium.se/home?access_token=A&refresh_token=R&token_hash=otp&type=recovery',
    `https://www.parium.se/team-invite?token=${hexToken}&access_token=leaked&type=recovery`,
    'https://www.parium.se/email-confirm?token_hash=&type=recovery',
  ])('scrubs malformed auth secrets fail-closed on every route: %s', (href) => {
    const target = getAuthRedirectTarget(href);

    expect(target).not.toBeNull();
    const parsed = new URL(target!);
    expect(parsed.pathname).toBe('/auth');
    for (const key of ['access_token', 'refresh_token', 'token_hash', 'token']) {
      expect(parsed.searchParams.has(key)).toBe(false);
      expect(new URLSearchParams(parsed.hash.slice(1)).has(key)).toBe(false);
    }
    expect(parsed.searchParams.get('error_code')).toBe('invalid_auth_link');
    expect(getAuthRedirectTarget(target!)).toBeNull();
  });

  it('preserves a valid team-invite return target', () => {
    expect(sanitizeAuthReturnTo(`/team-invite?token=${hexToken}`)).toBe(
      `/team-invite?token=${hexToken}`,
    );
  });

  it.each([
    'https://evil.example/team-invite?token=' + hexToken,
    '//evil.example/team-invite?token=' + hexToken,
    '/team-invite?token=too-short',
    '/admin',
    '/%2f%2fevil.example',
    '/team-invite?token=' + hexToken + '&next=https://evil.example',
  ])('rejects non-allowlisted return target %s', (candidate) => {
    expect(sanitizeAuthReturnTo(candidate)).toBeNull();
  });

  it.each([
    '/profile#notifications',
    '/settings#notifications',
    '/search-jobs',
    '/job-view/123e4567-e89b-12d3-a456-426614174000',
    '/jobb/stockholm/systemutvecklare',
  ])('keeps allowlisted internal return target %s', (candidate) => {
    expect(sanitizeAuthReturnTo(candidate)).toBe(candidate);
  });

  it('allows only the exact OAuth consent return route with a validated authorization id', () => {
    const candidate = '/.lovable/oauth/consent?authorization_id=auth_ABC-1234567890.xyz';
    expect(sanitizeAuthNext(candidate)).toBe(candidate);
  });

  it.each([
    'https://evil.example/.lovable/oauth/consent?authorization_id=auth_ABC-1234567890',
    '//evil.example/.lovable/oauth/consent?authorization_id=auth_ABC-1234567890',
    '/\\evil.example',
    '/%5Cevil.example',
    '/%2F%2Fevil.example',
    '/.lovable/oauth/consent',
    '/.lovable/oauth/consent?authorization_id=short',
    '/.lovable/oauth/consent?authorization_id=auth_ABC-1234567890&next=https://evil.example',
    '/.lovable/oauth/consent?authorization_id=auth_ABC-1234567890&authorization_id=duplicate',
    '/.lovable/oauth/consent?authorization_id=auth_ABC-1234567890#fragment',
    '/home?authorization_id=auth_ABC-1234567890',
  ])('rejects unsafe OAuth return target %s', (candidate) => {
    expect(sanitizeAuthNext(candidate)).toBeNull();
  });
});

describe('auth-link integration contracts', () => {
  const readRepoFile = (path: string) => readFileSync(path, 'utf8');

  it('has a dedicated in-memory auth bootstrap credential module', () => {
    expect(existsSync('src/lib/authBootstrapCredentials.ts')).toBe(true);
  });

  it('uses the bootstrap quarantine before App and keeps shared routing for client navigation', () => {
    expect(readRepoFile('src/main.tsx')).toContain('initializeAuthBootstrapCredentials');
    const bridge = readRepoFile('src/components/AuthTokenBridge.tsx');
    expect(bridge).toContain('quarantineRuntimeAuthCredentials');
    expect(bridge).not.toContain('window.location.replace');
  });

  it('runs a no-referrer auth URL gate before any index network work', () => {
    const html = readRepoFile('index.html');
    const referrerPolicy = html.indexOf('<meta name="referrer" content="no-referrer"');
    const authGate = html.indexOf('id="parium-auth-url-gate"');
    const firstInlineScript = html.indexOf('<script');
    const versionFetch = html.indexOf("fetch('/version.json'");
    const firstPreconnect = html.indexOf('<link rel="preconnect"');

    expect(referrerPolicy).toBeGreaterThan(-1);
    expect(authGate).toBeGreaterThan(-1);
    expect(referrerPolicy).toBeLessThan(firstInlineScript);
    expect(authGate).toBeLessThan(versionFetch);
    expect(authGate).toBeLessThan(firstPreconnect);
  });

  it('quarantines auth query credentials once and leaves a fully clean URL before modules load', () => {
    const html = readRepoFile('index.html');
    const gate = html.match(/<script id="parium-auth-url-gate">([\s\S]*?)<\/script>/)?.[1];
    expect(gate).toBeTruthy();
    if (!gate) return;

    window.history.replaceState(
      {},
      '',
      '/home?access_token=access-secret&refresh_token=refresh-secret&expires_in=3600&token_type=bearer&type=recovery',
    );
    Function(gate)();

    const current = new URL(window.location.href);
    expect(current.pathname).toBe('/auth');
    expect(current.search).toBe('');
    expect(current.hash).toBe('');

    const take = (window as typeof window & {
      __PARIUM_TAKE_AUTH_BOOTSTRAP__?: () => unknown;
    }).__PARIUM_TAKE_AUTH_BOOTSTRAP__;
    expect(take).toBeTypeOf('function');
    expect(take?.()).toEqual(expect.objectContaining({
      pathname: '/home',
      query: expect.objectContaining({
        access_token: ['access-secret'],
        refresh_token: ['refresh-secret'],
        expires_in: ['3600'],
        token_type: ['bearer'],
        type: ['recovery'],
      }),
    }));
    expect(take?.()).toBeNull();
    expect((window as typeof window & {
      __PARIUM_TAKE_AUTH_BOOTSTRAP__?: () => unknown;
    }).__PARIUM_TAKE_AUTH_BOOTSTRAP__).toBeUndefined();
  });

  it('quarantines confirmation secrets without leaving them in query or fragment', () => {
    const html = readRepoFile('index.html');
    const gate = html.match(/<script id="parium-auth-url-gate">([\s\S]*?)<\/script>/)?.[1];
    expect(gate).toBeTruthy();
    if (!gate) return;

    window.history.replaceState({}, '', '/email-confirm?confirm=confirmation-secret');
    Function(gate)();

    const current = new URL(window.location.href);
    expect(current.searchParams.has('confirm')).toBe(false);
    expect(current.hash).toBe('');
    const take = (window as typeof window & {
      __PARIUM_TAKE_AUTH_BOOTSTRAP__?: () => unknown;
    }).__PARIUM_TAKE_AUTH_BOOTSTRAP__;
    expect(take?.()).toEqual(expect.objectContaining({
      pathname: '/email-confirm',
      query: { confirm: ['confirmation-secret'] },
    }));
  });

  it('quarantines mixed confirm and OTP credentials for fail-closed classification', () => {
    const html = readRepoFile('index.html');
    const gate = html.match(/<script id="parium-auth-url-gate">([\s\S]*?)<\/script>/)?.[1];
    expect(gate).toBeTruthy();
    if (!gate) return;

    window.history.replaceState(
      {},
      '',
      '/auth?confirm=confirmation-secret#token_hash=otp-secret&type=signup',
    );
    Function(gate)();

    expect(window.location.pathname).toBe('/auth');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    const take = (window as typeof window & {
      __PARIUM_TAKE_AUTH_BOOTSTRAP__?: () => unknown;
    }).__PARIUM_TAKE_AUTH_BOOTSTRAP__;
    expect(take?.()).toEqual(expect.objectContaining({
      query: { confirm: ['confirmation-secret'] },
      fragment: expect.objectContaining({
        token_hash: ['otp-secret'],
        type: ['signup'],
      }),
    }));
  });

  it('does not let the inline gate capture route-owned or legacy unsubscribe tokens', () => {
    const html = readRepoFile('index.html');
    const gate = html.match(/<script id="parium-auth-url-gate">([\s\S]*?)<\/script>/)?.[1];
    expect(gate).toBeTruthy();
    if (!gate) return;

    window.history.replaceState({}, '', `/team-invite?token=${hexToken}&type=recovery`);
    Function(gate)();
    expect(window.location.pathname).toBe('/team-invite');
    expect(new URL(window.location.href).searchParams.get('token')).toBe(hexToken);

    window.history.replaceState({}, '', `/?token=${hexToken}`);
    Function(gate)();
    expect(window.location.pathname).toBe('/unsubscribe');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });

  it('loads App only after the synchronous auth redirect decision', () => {
    const main = readRepoFile('src/main.tsx');
    expect(main).not.toMatch(/^import App from ['"]\.\/App['"];?$/m);
    expect(main).toContain('initializeAuthBootstrapCredentials()');
    expect(main).toContain("await import('./App')");
    expect(main.indexOf('initializeAuthBootstrapCredentials()')).toBeLessThan(main.indexOf("await import('./App')"));
  });

  it('disables Supabase automatic URL session detection', () => {
    const client = readRepoFile('src/integrations/supabase/client.ts');
    expect(client).toContain('detectSessionInUrl: false');
  });

  it('precaches the dynamically loaded App shell chunk for offline startup', () => {
    expect(readRepoFile('vite.config.ts')).toContain("'assets/App-*.js'");
  });

  it('sanitizes persisted returnTo values before navigation', () => {
    const auth = readRepoFile('src/pages/Auth.tsx');
    expect(auth).toContain('sanitizeAuthReturnTo');
    expect(auth).not.toContain("returnTo.startsWith('/')");
  });

  it('strictly sanitizes OAuth next and onboarding saved-search navigation', () => {
    const auth = readRepoFile('src/pages/Auth.tsx');
    const index = readRepoFile('src/pages/Index.tsx');

    expect(auth).toContain('sanitizeAuthNext');
    expect(auth).not.toContain("nextParam.startsWith('/')");
    expect(index).toContain('sanitizeAuthReturnTo');
    expect(index).not.toContain("intent.returnTo.startsWith('/')");
  });

  it('does not leave token or full-URL console logging in confirmation/recovery pages', () => {
    expect(readRepoFile('src/pages/Auth.tsx')).not.toMatch(/console\./);
    expect(readRepoFile('src/pages/EmailConfirm.tsx')).not.toMatch(/console\./);
    expect(readRepoFile('src/pages/EmailRedirect.tsx')).not.toMatch(/console\./);
  });

  it('requires the confirmation edge to prove that it processed a token', () => {
    const auth = readRepoFile('src/hooks/useAuth.tsx');
    expect(auth).toContain('data?.processed !== true');
  });

  it('does not expose the deprecated fake verification route', () => {
    const app = readRepoFile('src/App.tsx');
    expect(app).not.toContain('path="/verify"');
    expect(app).not.toContain('path="/reset-redirect"');
  });
});
