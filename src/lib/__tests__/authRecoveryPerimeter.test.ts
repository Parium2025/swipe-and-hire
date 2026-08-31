import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_RESET_APP_ORIGIN,
  resolveResetAppOrigin,
} from '../../../supabase/functions/send-reset-password/reset-origin';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Auth recovery perimeter', () => {
  it('retires the legacy unsigned recovery redirect without parsing or forwarding its payload', () => {
    const code = source('supabase/functions/redirect-recovery/index.ts');

    expect(code).toContain('status: 410');
    expect(code).toContain('Cache-Control');
    expect(code).toContain('no-store');
    expect(code).toContain('Referrer-Policy');
    expect(code).toContain('no-referrer');
    expect(code).not.toContain('req.url');
    expect(code).not.toContain('searchParams');
    expect(code).not.toContain('atob(');
    expect(code).not.toContain('Location');
    expect(code).not.toContain('hardenRecoveryRedirectTarget');
  });

  it('retires the second legacy reset redirect without forwarding query credentials', () => {
    const code = source('supabase/functions/reset-redirect/index.ts');

    expect(code).toContain('status: 410');
    expect(code).toContain('no-store');
    expect(code).toContain('no-referrer');
    expect(code).not.toContain('new URL(req.url)');
    expect(code).not.toContain('searchParams');
    expect(code).not.toContain('Location');
    expect(code).not.toContain('createClient');
  });

  it('uses the canonical Parium origin for production regardless of non-production configuration', () => {
    expect(PRODUCTION_RESET_APP_ORIGIN).toBe('https://www.parium.se');
    expect(resolveResetAppOrigin({
      deploymentEnv: 'production',
      configuredOrigin: 'https://attacker.example',
    })).toBe(PRODUCTION_RESET_APP_ORIGIN);
  });

  it('fails closed when the server deployment environment is absent', () => {
    expect(resolveResetAppOrigin()).toBeNull();
    expect(resolveResetAppOrigin({
      configuredOrigin: 'https://preview.lovable.app',
    })).toBeNull();
  });

  it('allows only an exact trusted server-configured origin in preview or staging', () => {
    expect(resolveResetAppOrigin({ deploymentEnv: 'preview' })).toBeNull();
    expect(resolveResetAppOrigin({
      deploymentEnv: 'preview',
      configuredOrigin: 'https://id-preview--09c4e686-17a9-467e-89b1-3cf832371d49.lovable.app',
    })).toBe('https://id-preview--09c4e686-17a9-467e-89b1-3cf832371d49.lovable.app');
    expect(resolveResetAppOrigin({
      deploymentEnv: 'staging',
      configuredOrigin: 'https://staging.parium.se/',
    })).toBe('https://staging.parium.se');
  });

  it('fails closed for unknown environments and malformed or untrusted non-production origins', () => {
    const rejected = [
      { deploymentEnv: 'development', configuredOrigin: 'https://preview.lovable.app' },
      { deploymentEnv: 'preview', configuredOrigin: 'http://preview.lovable.app' },
      { deploymentEnv: 'preview', configuredOrigin: 'https://preview.lovable.app/auth' },
      { deploymentEnv: 'preview', configuredOrigin: 'https://preview.lovable.app?next=evil' },
      { deploymentEnv: 'preview', configuredOrigin: 'https://preview.lovable.app.evil.example' },
      { deploymentEnv: 'staging', configuredOrigin: 'https://evil.example' },
    ];

    for (const candidate of rejected) {
      expect(resolveResetAppOrigin(candidate)).toBeNull();
    }
  });

  it('never derives the reset redirect from the anonymous request body', () => {
    const code = source('supabase/functions/send-reset-password/index.ts');

    expect(code).toContain('resolveResetAppOrigin');
    expect(code).toContain('Deno.env.get("PARIUM_DEPLOYMENT_ENV")');
    expect(code).toContain('Deno.env.get("PARIUM_RESET_APP_ORIGIN")');
    expect(code).not.toContain('body.origin');
    expect(code).not.toContain('approvedAppOrigin');
  });
});
