export type SupportedAuthOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email';

type AuthBootstrapPublicState = {
  pathname: string;
  type?: string;
  reset: boolean;
  expired: boolean;
  used: boolean;
  tokenUsed: boolean;
  issued?: string;
  errorCode?: string;
  errorDescription?: string;
};

export type AuthBootstrapCredential =
  | (AuthBootstrapPublicState & {
      family: 'custom_confirm';
      confirmToken: string;
    })
  | (AuthBootstrapPublicState & {
      family: 'otp';
      tokenHash: string;
      type: SupportedAuthOtpType;
    })
  | (AuthBootstrapPublicState & {
      family: 'bearer';
      accessToken: string;
      refreshToken: string;
      providerToken?: string;
      providerRefreshToken?: string;
    })
  | (AuthBootstrapPublicState & {
      family: 'pkce';
      code: string;
    })
  | (AuthBootstrapPublicState & {
      family: 'public_state';
    })
  | (AuthBootstrapPublicState & {
      family: 'invalid';
      reason: string;
    });

type RawParameterMap = Record<string, string[]>;

type RawAuthBootstrapPayload = {
  version: 1;
  pathname: string;
  query: RawParameterMap;
  fragment: RawParameterMap;
};

declare global {
  interface Window {
    __PARIUM_TAKE_AUTH_BOOTSTRAP__?: () => unknown;
  }
}

const SUPPORTED_OTP_TYPES = new Set<SupportedAuthOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

const SECRET_KEYS = new Set([
  'access_token',
  'refresh_token',
  'token_hash',
  'token',
  'confirm',
  'code',
  'provider_token',
  'provider_refresh_token',
]);

const KNOWN_KEYS = new Set([
  ...SECRET_KEYS,
  'expires_in',
  'expires_at',
  'token_type',
  'type',
  'reset',
  'expired',
  'used',
  'token_used',
  'issued',
  'error',
  'error_code',
  'error_description',
  'error_message',
]);

const MAX_PARAMETER_LENGTH = 32_768;
const ROUTE_OWN_TOKEN_PATHS = new Set(['/unsubscribe', '/team-invite']);
const CONFIRMATION_PATHS = new Set(['/confirm', '/email-confirm', '/email-redirect']);
const LEGACY_UNSUBSCRIBE_TOKEN = /^[a-f0-9]{64}$/i;

let initialized = false;
let pendingCredential: AuthBootstrapCredential | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const invalid = (
  pathname: string,
  reason: string,
  publicState: Partial<AuthBootstrapPublicState> = {},
): AuthBootstrapCredential => ({
  family: 'invalid',
  pathname,
  reset: publicState.reset ?? false,
  expired: publicState.expired ?? false,
  used: publicState.used ?? false,
  tokenUsed: publicState.tokenUsed ?? false,
  type: publicState.type,
  issued: publicState.issued,
  errorCode: publicState.errorCode,
  errorDescription: publicState.errorDescription,
  reason,
});

const parseRawPayload = (payload: unknown): RawAuthBootstrapPayload | null => {
  if (!isRecord(payload) || payload.version !== 1) return null;
  if (typeof payload.pathname !== 'string' ||
      !payload.pathname.startsWith('/') ||
      payload.pathname.length > 2048) {
    return null;
  }
  if (!isRecord(payload.query) || !isRecord(payload.fragment)) return null;

  const parseMap = (source: Record<string, unknown>): RawParameterMap | null => {
    const result: RawParameterMap = {};
    for (const [key, value] of Object.entries(source)) {
      if (!KNOWN_KEYS.has(key) || !Array.isArray(value)) return null;
      if (value.some((entry) => typeof entry !== 'string' || entry.length > MAX_PARAMETER_LENGTH)) {
        return null;
      }
      result[key] = [...value] as string[];
    }
    return result;
  };

  const query = parseMap(payload.query);
  const fragment = parseMap(payload.fragment);
  return query && fragment
    ? { version: 1, pathname: payload.pathname, query, fragment }
    : null;
};

export const classifyAuthBootstrapPayload = (payload: unknown): AuthBootstrapCredential => {
  const parsed = parseRawPayload(payload);
  if (!parsed) return invalid('/auth', 'invalid_payload');

  let ambiguity: string | null = null;
  const read = (key: string): string | undefined => {
    const values = [...(parsed.query[key] ?? []), ...(parsed.fragment[key] ?? [])];
    if (values.length === 0) return undefined;
    if (values.length > 1) {
      const identicalPublicType = key === 'type' && values.every((value) => value === values[0]);
      if (!identicalPublicType) ambiguity = 'ambiguous_parameters';
    }
    return values[0];
  };

  const type = read('type');
  const resetValue = read('reset');
  const expiredValue = read('expired');
  const usedValue = read('used');
  const tokenUsedValue = read('token_used');
  const issued = read('issued');
  const errorCode = read('error_code') || read('error');
  const errorDescription = read('error_description') || read('error_message');
  const publicState: AuthBootstrapPublicState = {
    pathname: parsed.pathname,
    type,
    reset: resetValue === 'true',
    expired: expiredValue === 'true',
    used: usedValue === 'true',
    tokenUsed: tokenUsedValue === 'true',
    issued,
    errorCode,
    errorDescription,
  };

  const accessToken = read('access_token');
  const refreshToken = read('refresh_token');
  const tokenHash = read('token_hash');
  const token = read('token');
  const confirmToken = read('confirm');
  const code = read('code');
  const providerToken = read('provider_token');
  const providerRefreshToken = read('provider_refresh_token');

  const emptySecret = [...SECRET_KEYS].some((key) => {
    const present = (parsed.query[key]?.length ?? 0) + (parsed.fragment[key]?.length ?? 0) > 0;
    return present && read(key) === '';
  });
  if (ambiguity || emptySecret) {
    return invalid(parsed.pathname, ambiguity || 'empty_credential', publicState);
  }

  const hasBearerSignal = Boolean(accessToken || refreshToken || providerToken || providerRefreshToken);
  const hasOtpSignal = Boolean(tokenHash || token);
  const familyCount = [Boolean(confirmToken), hasOtpSignal, hasBearerSignal, Boolean(code)]
    .filter(Boolean).length;
  if (familyCount > 1) return invalid(parsed.pathname, 'mixed_credential_families', publicState);

  if (confirmToken) {
    return { ...publicState, family: 'custom_confirm', confirmToken };
  }

  if (hasOtpSignal) {
    if (tokenHash && token) return invalid(parsed.pathname, 'ambiguous_otp', publicState);
    const effectiveType = type || (publicState.reset ? 'recovery' : undefined);
    if (!effectiveType || !SUPPORTED_OTP_TYPES.has(effectiveType as SupportedAuthOtpType)) {
      return invalid(parsed.pathname, 'unsupported_otp_type', publicState);
    }
    return {
      ...publicState,
      family: 'otp',
      tokenHash: tokenHash || token!,
      type: effectiveType as SupportedAuthOtpType,
    };
  }

  if (hasBearerSignal) {
    if (!accessToken || !refreshToken) {
      return invalid(parsed.pathname, 'partial_bearer', publicState);
    }
    return {
      ...publicState,
      family: 'bearer',
      accessToken,
      refreshToken,
      providerToken,
      providerRefreshToken,
    };
  }

  if (code) return { ...publicState, family: 'pkce', code };

  return { ...publicState, family: 'public_state' };
};

export const initializeAuthBootstrapCredentials = (): AuthBootstrapCredential | null => {
  if (initialized) return pendingCredential;
  initialized = true;
  if (typeof window === 'undefined') return null;

  const take = window.__PARIUM_TAKE_AUTH_BOOTSTRAP__;
  try {
    delete window.__PARIUM_TAKE_AUTH_BOOTSTRAP__;
  } catch {
    // A non-configurable injected channel is not trusted.
    return null;
  }
  if (typeof take !== 'function') return null;

  try {
    pendingCredential = classifyAuthBootstrapPayload(take());
  } catch {
    pendingCredential = invalid('/auth', 'channel_failure');
  }
  return pendingCredential;
};

export const consumeAuthBootstrapCredentials = (): AuthBootstrapCredential | null => {
  const credential = pendingCredential;
  pendingCredential = null;
  return credential;
};

/**
 * Quarantines credentials introduced by client-side navigation after the
 * document's inline head gate has already run. The URL is scrubbed
 * synchronously and the classified value is kept only in this module's
 * one-time memory slot for the destination route.
 */
export const quarantineRuntimeAuthCredentials = (href: string): string | null => {
  if (typeof window === 'undefined') return null;

  let current: URL;
  try {
    current = new URL(href);
  } catch {
    return null;
  }

  const originalPathname = current.pathname.length > 1
    ? current.pathname.replace(/\/+$/, '')
    : current.pathname;
  const queryParams = current.searchParams;
  const fragmentParams = new URLSearchParams(
    current.hash.startsWith('#') ? current.hash.slice(1) : current.hash,
  );
  const routeOwnsToken = ROUTE_OWN_TOKEN_PATHS.has(originalPathname);
  const legacyToken = queryParams.get('token') || '';
  const hasLegacyBlocker =
    queryParams.has('type') || queryParams.has('token_hash') || queryParams.has('reset') ||
    queryParams.has('access_token') || queryParams.has('refresh_token') ||
    fragmentParams.has('type') || fragmentParams.has('token_hash') || fragmentParams.has('token') ||
    fragmentParams.has('access_token') || fragmentParams.has('refresh_token');

  if ((originalPathname === '/' || originalPathname === '/auth') &&
      !hasLegacyBlocker && LEGACY_UNSUBSCRIBE_TOKEN.test(legacyToken)) {
    window.history.replaceState(window.history.state, '', '/unsubscribe');
    return '/unsubscribe';
  }

  const has = (key: string) => queryParams.has(key) || fragmentParams.has(key);
  const authSignal =
    has('access_token') || has('refresh_token') || has('token_hash') ||
    has('provider_token') || has('provider_refresh_token') || has('confirm') || has('code') ||
    (!routeOwnsToken && has('token')) ||
    (originalPathname === '/auth' && (
      has('reset') || has('type') || has('error') || has('error_code') ||
      has('error_description') || has('error_message')
    ));
  if (!authSignal) return null;

  const query: RawParameterMap = {};
  const fragment: RawParameterMap = {};
  const capture = (
    source: URLSearchParams,
    destination: RawParameterMap,
    key: string,
  ) => {
    if (!source.has(key)) return;
    destination[key] = source.getAll(key);
    source.delete(key);
  };
  for (const key of KNOWN_KEYS) {
    capture(queryParams, query, key);
    capture(fragmentParams, fragment, key);
  }

  const hasNonConfirmationCredential = [
    'access_token', 'refresh_token', 'token_hash', 'token', 'code',
  ].some((key) => Object.prototype.hasOwnProperty.call(query, key) ||
    Object.prototype.hasOwnProperty.call(fragment, key));
  if (!CONFIRMATION_PATHS.has(originalPathname) || hasNonConfirmationCredential) {
    current.pathname = '/auth';
  }
  const cleanHash = fragmentParams.toString();
  current.hash = cleanHash ? `#${cleanHash}` : '';
  const cleanTarget = `${current.pathname}${current.search}${current.hash}`;

  // URL cleanup must happen before the credential becomes observable to any
  // route component or before a privileged request can start.
  window.history.replaceState(window.history.state, '', cleanTarget);

  const nextCredential = classifyAuthBootstrapPayload({
    version: 1,
    pathname: originalPathname,
    query,
    fragment,
  });
  pendingCredential = pendingCredential === null
    ? nextCredential
    : invalid('/auth', 'concurrent_credential');
  initialized = true;
  return cleanTarget;
};

/**
 * Transfers a custom confirmation credential between two React routes in the
 * same document. It deliberately accepts no other credential family and never
 * serializes the token.
 */
export const forwardCustomConfirmationCredential = (
  credential: AuthBootstrapCredential | null,
): boolean => {
  if (credential?.family !== 'custom_confirm' || pendingCredential !== null) return false;
  if (!credential.confirmToken || credential.confirmToken.length > MAX_PARAMETER_LENGTH) return false;
  pendingCredential = credential;
  initialized = true;
  return true;
};

export const resetAuthBootstrapCredentialsForTests = (): void => {
  initialized = false;
  pendingCredential = null;
};
