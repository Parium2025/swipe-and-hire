const OWN_TOKEN_PATHS = new Set([
  '/unsubscribe',
  '/team-invite',
  '/confirm',
  '/email-confirm',
]);

const HEX_TOKEN = /^[a-f0-9]{64}$/i;
const SAFE_SEGMENT = /^[A-Za-z0-9._~%-]+$/;
const AUTHORIZATION_ID = /^[A-Za-z0-9._~-]{8,512}$/;

export function buildExternalConfirmationUrl(baseUrl: string, token: string): string {
  const target = new URL('/confirm', baseUrl);
  const fragment = new URLSearchParams();
  fragment.set('confirm', token);
  target.hash = fragment.toString();
  return target.toString();
}

const readFirst = (hash: URLSearchParams, search: URLSearchParams, key: string) =>
  hash.get(key) || search.get(key);

/**
 * Returns the only full-page redirect that an auth-bearing URL is allowed to
 * trigger. Credentials are always moved to the fragment so they are not sent
 * in HTTP requests or referrer headers.
 */
export function getAuthRedirectTarget(href: string): string | null {
  let current: URL;
  try {
    current = new URL(href);
  } catch {
    return null;
  }

  const pathname = current.pathname.length > 1
    ? current.pathname.replace(/\/+$/, '')
    : current.pathname;

  const search = current.searchParams;
  const hash = new URLSearchParams(current.hash.startsWith('#') ? current.hash.slice(1) : current.hash);
  const accessToken = readFirst(hash, search, 'access_token');
  const refreshToken = readFirst(hash, search, 'refresh_token');
  const tokenHash = readFirst(hash, search, 'token_hash');
  const token = readFirst(hash, search, 'token');
  const providerToken = readFirst(hash, search, 'provider_token');
  const providerRefreshToken = readFirst(hash, search, 'provider_refresh_token');
  const type = readFirst(hash, search, 'type');
  const errorCode = readFirst(hash, search, 'error_code') || readFirst(hash, search, 'error');
  const errorDescription = readFirst(hash, search, 'error_description') || readFirst(hash, search, 'error_message');

  const accessKeyPresent = hash.has('access_token') || search.has('access_token');
  const refreshKeyPresent = hash.has('refresh_token') || search.has('refresh_token');
  const tokenHashKeyPresent = hash.has('token_hash') || search.has('token_hash');
  const tokenKeyPresent = hash.has('token') || search.has('token');
  const providerTokenKeyPresent = hash.has('provider_token') || search.has('provider_token');
  const providerRefreshTokenKeyPresent = hash.has('provider_refresh_token') || search.has('provider_refresh_token');
  const ownPathHasAuthSignal =
    accessKeyPresent ||
    refreshKeyPresent ||
    tokenHashKeyPresent ||
    providerTokenKeyPresent ||
    providerRefreshTokenKeyPresent ||
    hash.has('token');

  // These routes own their ordinary token/confirm parameters. Supabase auth
  // credentials appended to the same URL are still scrubbed below.
  if (OWN_TOKEN_PATHS.has(pathname) && !ownPathHasAuthSignal) return null;

  const legacyToken = search.get('token') || '';
  const isLegacyUnsubscribe =
    (pathname === '/' || pathname === '/auth') &&
    !search.get('type') &&
    !search.get('token_hash') &&
    !search.get('reset') &&
    !accessToken &&
    !refreshToken &&
    HEX_TOKEN.test(legacyToken);

  if (isLegacyUnsubscribe) {
    return new URL('/unsubscribe', current.origin).toString();
  }

  const hasAnyAccessCredential = Boolean(accessToken || refreshToken);
  const hasAccessPair = Boolean(accessToken && refreshToken);
  const hasOtpToken = Boolean(tokenHash || token);
  const hasMultipleOtpTokens = Boolean(tokenHash && token);
  const hasProviderCredential = Boolean(providerToken || providerRefreshToken);
  const hasEmptyCredential =
    (accessKeyPresent && !accessToken) ||
    (refreshKeyPresent && !refreshToken) ||
    (tokenHashKeyPresent && !tokenHash) ||
    (tokenKeyPresent && !token) ||
    (providerTokenKeyPresent && !providerToken) ||
    (providerRefreshTokenKeyPresent && !providerRefreshToken);
  const isMalformedCredentialSet =
    (hasAnyAccessCredential && !hasAccessPair) ||
    (hasProviderCredential && !hasAccessPair) ||
    (hasAccessPair && hasOtpToken) ||
    hasMultipleOtpTokens ||
    hasEmptyCredential;

  const copyPublicAuthState = (target: URL) => {
    if (type) target.searchParams.set('type', type);
    for (const key of ['reset', 'expired', 'used', 'token_used', 'issued']) {
      const value = readFirst(hash, search, key);
      if (value) target.searchParams.set(key, value);
    }
  };

  if (isMalformedCredentialSet) {
    const invalidTarget = new URL('/auth', current.origin);
    copyPublicAuthState(invalidTarget);
    invalidTarget.searchParams.set('error_code', 'invalid_auth_link');
    return invalidTarget.toString() === current.toString() ? null : invalidTarget.toString();
  }

  const hasAuthSecretInQuery =
    search.has('access_token') ||
    search.has('refresh_token') ||
    search.has('token_hash') ||
    search.has('token') ||
    search.has('provider_token') ||
    search.has('provider_refresh_token');

  // A normalized /auth URL with credentials already isolated in the fragment
  // is the terminal state. Query credentials must still be rewritten once.
  if (pathname === '/auth' && !hasAuthSecretInQuery) return null;

  const hasRecoverySignal = type === 'recovery' && !hasAnyAccessCredential;
  if (!hasAccessPair && !hasOtpToken && !hasRecoverySignal && !errorCode && !errorDescription) {
    return null;
  }

  const target = new URL('/auth', current.origin);
  if (type) target.searchParams.set('type', type);
  if (errorCode) target.searchParams.set('error_code', errorCode);
  if (errorDescription) target.searchParams.set('error_description', errorDescription);

  for (const key of ['reset', 'expired', 'used', 'token_used', 'issued']) {
    const value = readFirst(hash, search, key);
    if (value) target.searchParams.set(key, value);
  }

  const secretHash = new URLSearchParams();
  if (accessToken && refreshToken) {
    secretHash.set('access_token', accessToken);
    secretHash.set('refresh_token', refreshToken);
    for (const key of [
      'expires_in',
      'expires_at',
      'token_type',
      'provider_token',
      'provider_refresh_token',
    ]) {
      const value = readFirst(hash, search, key);
      if (value) secretHash.set(key, value);
    }
  }
  if (tokenHash) secretHash.set('token_hash', tokenHash);
  else if (token) secretHash.set('token', token);
  if (type) secretHash.set('type', type);
  if ([...secretHash.keys()].length > 0) target.hash = secretHash.toString();

  return target.toString();
}

/**
 * OAuth login round-trips may only return to the local Lovable consent route.
 * The authorization id is opaque but restricted to a bounded URL-safe value.
 */
export function sanitizeAuthNext(candidate: unknown): string | null {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 2048) {
    return null;
  }
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return null;
  }
  const hasControlCharacter = [...candidate].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (/%2f|%5c/i.test(candidate) || hasControlCharacter) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate, 'https://parium.invalid');
  } catch {
    return null;
  }

  if (parsed.origin !== 'https://parium.invalid') return null;
  if (`${parsed.pathname}${parsed.search}${parsed.hash}` !== candidate) return null;
  if (parsed.pathname !== '/.lovable/oauth/consent' || parsed.hash) return null;

  const keys = [...parsed.searchParams.keys()];
  const authorizationId = parsed.searchParams.get('authorization_id') || '';
  if (keys.length !== 1 || keys[0] !== 'authorization_id') return null;
  return AUTHORIZATION_ID.test(authorizationId) ? candidate : null;
}

/**
 * Restricts post-auth navigation to the small set of same-origin routes that
 * can legitimately initiate an auth round-trip.
 */
export function sanitizeAuthReturnTo(candidate: unknown): string | null {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 2048) {
    return null;
  }
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return null;
  }
  const hasControlCharacter = [...candidate].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (/%2f|%5c/i.test(candidate) || hasControlCharacter) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate, 'https://parium.invalid');
  } catch {
    return null;
  }
  if (parsed.origin !== 'https://parium.invalid') return null;

  const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (normalized !== candidate) return null;

  if (candidate === '/profile#notifications' || candidate === '/settings#notifications') {
    return candidate;
  }
  if (candidate === '/search-jobs') return candidate;

  if (parsed.pathname === '/team-invite' && !parsed.hash) {
    const keys = [...parsed.searchParams.keys()];
    const token = parsed.searchParams.get('token') || '';
    return keys.length === 1 && keys[0] === 'token' && HEX_TOKEN.test(token)
      ? candidate
      : null;
  }

  if (parsed.search || parsed.hash) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (!segments.every((segment) => SAFE_SEGMENT.test(segment))) return null;

  if (segments.length === 2 && (segments[0] === 'job-view' || segments[0] === 'job-application')) {
    return candidate;
  }
  if (segments[0] === 'jobb' && segments.length >= 1 && segments.length <= 3) {
    return candidate;
  }

  return null;
}
