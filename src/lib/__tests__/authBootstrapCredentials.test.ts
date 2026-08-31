import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as bootstrap from '@/lib/authBootstrapCredentials';

const payload = (
  query: Record<string, string[]> = {},
  fragment: Record<string, string[]> = {},
  pathname = '/auth',
) => ({ version: 1, pathname, query, fragment });

describe('auth bootstrap credentials', () => {
  afterEach(() => {
    bootstrap.resetAuthBootstrapCredentialsForTests();
    delete (window as typeof window & {
      __PARIUM_TAKE_AUTH_BOOTSTRAP__?: () => unknown;
    }).__PARIUM_TAKE_AUTH_BOOTSTRAP__;
  });

  it('exposes classification, initialization and one-time consumption APIs', () => {
    expect(bootstrap).toEqual(expect.objectContaining({
      classifyAuthBootstrapPayload: expect.any(Function),
      initializeAuthBootstrapCredentials: expect.any(Function),
      consumeAuthBootstrapCredentials: expect.any(Function),
      quarantineRuntimeAuthCredentials: expect.any(Function),
      forwardCustomConfirmationCredential: expect.any(Function),
      resetAuthBootstrapCredentialsForTests: expect.any(Function),
    }));
  });

  it.each([
    [
      'custom confirmation',
      payload({ confirm: ['confirm-secret'] }, {}, '/email-confirm'),
      { family: 'custom_confirm', confirmToken: 'confirm-secret' },
    ],
    [
      'OTP signup',
      payload({}, { token_hash: ['otp-secret'], type: ['signup'] }),
      { family: 'otp', tokenHash: 'otp-secret', type: 'signup' },
    ],
    [
      'legacy recovery OTP',
      payload({}, { token: ['otp-secret'], type: ['recovery'] }),
      { family: 'otp', tokenHash: 'otp-secret', type: 'recovery' },
    ],
    [
      'bearer pair',
      payload({}, {
        access_token: ['access-secret'],
        refresh_token: ['refresh-secret'],
        type: ['recovery'],
      }),
      {
        family: 'bearer',
        accessToken: 'access-secret',
        refreshToken: 'refresh-secret',
        type: 'recovery',
      },
    ],
    [
      'PKCE code',
      payload({ code: ['pkce-code'] }),
      { family: 'pkce', code: 'pkce-code' },
    ],
  ])('classifies exactly one %s credential family', (_label, raw, expected) => {
    expect(bootstrap.classifyAuthBootstrapPayload(raw)).toEqual(
      expect.objectContaining(expected),
    );
  });

  it.each([
    [
      'confirm plus OTP',
      payload({ confirm: ['confirm-secret'] }, { token_hash: ['otp-secret'], type: ['signup'] }),
    ],
    [
      'bearer plus OTP',
      payload({}, {
        access_token: ['access-secret'],
        refresh_token: ['refresh-secret'],
        token_hash: ['otp-secret'],
        type: ['recovery'],
      }),
    ],
    ['partial bearer', payload({}, { access_token: ['access-secret'], type: ['recovery'] })],
    ['both OTP aliases', payload({}, { token: ['one'], token_hash: ['two'], type: ['recovery'] })],
    ['duplicate credential', payload({ confirm: ['one', 'two'] })],
    ['empty credential', payload({ confirm: [''] })],
    ['unsupported OTP type', payload({}, { token_hash: ['otp-secret'], type: ['unknown'] })],
  ])('fails closed for %s', (_label, raw) => {
    expect(bootstrap.classifyAuthBootstrapPayload(raw)).toEqual(
      expect.objectContaining({ family: 'invalid' }),
    );
  });

  it('represents a tokenless recovery callback as public state, never as a grant', () => {
    expect(bootstrap.classifyAuthBootstrapPayload(payload({
      reset: ['true'],
      type: ['recovery'],
    }))).toEqual(expect.objectContaining({
      family: 'public_state',
      reset: true,
      type: 'recovery',
    }));
  });

  it('takes the head payload exactly once, deletes the channel and never writes credentials to storage', () => {
    const take = vi.fn(() => payload({}, {
      token_hash: ['otp-secret'],
      type: ['recovery'],
    }));
    Object.defineProperty(window, '__PARIUM_TAKE_AUTH_BOOTSTRAP__', {
      configurable: true,
      value: take,
    });
    const localWrite = vi.spyOn(Storage.prototype, 'setItem');

    expect(bootstrap.initializeAuthBootstrapCredentials()).toEqual(
      expect.objectContaining({ family: 'otp', tokenHash: 'otp-secret', type: 'recovery' }),
    );
    expect(bootstrap.initializeAuthBootstrapCredentials()).toEqual(
      expect.objectContaining({ family: 'otp' }),
    );
    expect(take).toHaveBeenCalledTimes(1);
    expect((window as typeof window & {
      __PARIUM_TAKE_AUTH_BOOTSTRAP__?: () => unknown;
    }).__PARIUM_TAKE_AUTH_BOOTSTRAP__).toBeUndefined();
    expect(localWrite).not.toHaveBeenCalled();

    expect(bootstrap.consumeAuthBootstrapCredentials()).toEqual(
      expect.objectContaining({ family: 'otp', tokenHash: 'otp-secret' }),
    );
    expect(bootstrap.consumeAuthBootstrapCredentials()).toBeNull();
    localWrite.mockRestore();
  });

  it('quarantines a client-navigation credential before returning its clean auth route', () => {
    window.history.replaceState(
      {},
      '',
      '/home?access_token=runtime-access&refresh_token=runtime-refresh&type=signup#provider_token=provider',
    );
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');

    expect(bootstrap.quarantineRuntimeAuthCredentials(window.location.href)).toBe('/auth');
    expect(window.location.pathname).toBe('/auth');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(bootstrap.consumeAuthBootstrapCredentials()).toEqual(expect.objectContaining({
      family: 'bearer',
      accessToken: 'runtime-access',
      refreshToken: 'runtime-refresh',
      providerToken: 'provider',
      type: 'signup',
    }));
    expect(storageWrite).not.toHaveBeenCalled();
    storageWrite.mockRestore();
  });

  it('does not capture a route-owned team invitation token during client navigation', () => {
    const invitationToken = 'a'.repeat(64);
    window.history.replaceState({}, '', `/team-invite?token=${invitationToken}`);

    expect(bootstrap.quarantineRuntimeAuthCredentials(window.location.href)).toBeNull();
    expect(window.location.search).toBe(`?token=${invitationToken}`);
    expect(bootstrap.consumeAuthBootstrapCredentials()).toBeNull();
  });

  it('forwards a custom confirmation credential once within the same document', () => {
    const credential = bootstrap.classifyAuthBootstrapPayload(
      payload({ confirm: ['same-document-secret'] }, {}, '/email-redirect'),
    );

    expect(bootstrap.forwardCustomConfirmationCredential(credential)).toBe(true);
    expect(bootstrap.forwardCustomConfirmationCredential(credential)).toBe(false);
    expect(bootstrap.consumeAuthBootstrapCredentials()).toEqual(expect.objectContaining({
      family: 'custom_confirm',
      confirmToken: 'same-document-secret',
    }));
    expect(bootstrap.consumeAuthBootstrapCredentials()).toBeNull();
  });

  it('moves credentials into the fragment before a canonical cross-origin redirect', () => {
    const html = readFileSync('index.html', 'utf8');
    const gate = html.match(
      /<script id="parium-auth-url-gate">([\s\S]*?)<\/script>/,
    )?.[1];
    if (!gate) throw new Error('Missing auth URL gate');

    const replace = vi.fn();
    const fakeWindow = {
      location: {
        href: 'https://parium-ab.lovable.app/auth?code=pkce-secret&next=%2Fhome',
        hostname: 'parium-ab.lovable.app',
        pathname: '/auth',
        replace,
      },
      history: {
        state: null,
        replaceState: vi.fn(),
      },
    };

    Function('window', gate)(fakeWindow);

    expect(replace).toHaveBeenCalledTimes(1);
    const target = new URL(replace.mock.calls[0][0]);
    expect(target.origin).toBe('https://www.parium.se');
    expect(target.pathname).toBe('/auth');
    expect(target.searchParams.get('code')).toBeNull();
    expect(target.searchParams.get('next')).toBe('/home');
    expect(new URLSearchParams(target.hash.slice(1)).get('code')).toBe('pkce-secret');
    expect(fakeWindow.history.replaceState).not.toHaveBeenCalled();
  });
});
