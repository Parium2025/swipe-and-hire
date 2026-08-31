import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  enforceRateLimit,
  requestIp,
} from '../../../supabase/functions/_shared/rate-limit';

const atomicRateLimitMigration = resolve(
  process.cwd(),
  'supabase/migrations/20260830225000_atomic_public_auth_rate_limits.sql',
);

describe('atomic public auth rate limits', () => {
  it('reserves the coarse IP rule before identifier rules in one RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    const response = await enforceRateLimit(
      { rpc },
      'custom-signup',
      [
        { scope: 'email', identifier: 'Person@Example.com', limit: 3, windowSeconds: 3_600 },
        { scope: 'ip', identifier: '203.0.113.8', limit: 10, windowSeconds: 3_600 },
      ],
      {},
    );

    expect(response).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('reserve_rate_limits', {
      _rules: [
        expect.objectContaining({ scope: 'ip', limit: 10, window_seconds: 3_600 }),
        expect.objectContaining({ scope: 'email', limit: 3, window_seconds: 3_600 }),
      ],
    });

    const rules = rpc.mock.calls[0]?.[1]?._rules as Array<{ key: string }>;
    expect(rules[0]?.key).toMatch(/^custom-signup:ip:[a-f0-9]{64}$/);
    expect(rules[1]?.key).toMatch(/^custom-signup:email:[a-f0-9]{64}$/);
    expect(JSON.stringify(rules)).not.toContain('Person@Example.com');
    expect(JSON.stringify(rules)).not.toContain('203.0.113.8');
  });

  it('fails closed with one generic response when the reservation RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    const response = await enforceRateLimit(
      { rpc },
      'send-reset-password',
      [
        { scope: 'ip', identifier: '203.0.113.8', limit: 20, windowSeconds: 3_600 },
        { scope: 'email', identifier: 'person@example.com', limit: 5, windowSeconds: 3_600 },
      ],
      {},
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({
      error: 'Tjänsten är tillfälligt upptagen. Försök igen om en stund.',
    });
  });

  it('keeps IP first at every public auth call site', () => {
    for (const file of [
      'supabase/functions/custom-signup/index.ts',
      'supabase/functions/resend-confirmation/index.ts',
      'supabase/functions/send-reset-password/index.ts',
      'supabase/functions/confirm-email/index.ts',
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      const call = source.slice(source.indexOf('enforceRateLimit('));
      expect(call.indexOf('scope: "ip"')).toBeGreaterThan(-1);
      expect(call.indexOf('scope: "ip"')).toBeLessThan(call.indexOf('scope: "email"') > -1
        ? call.indexOf('scope: "email"')
        : call.indexOf('scope: "token"'));
    }
  });

  it('defines a service-role-only atomic reservation with bounded TTL cleanup', () => {
    const migration = readFileSync(atomicRateLimitMigration, 'utf8');
    const reservation = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.reserve_rate_limits'),
    );

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS expires_at');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits');
    expect(migration).toContain('FOR UPDATE SKIP LOCKED');
    expect(migration).toContain('LEAST(GREATEST(COALESCE(_batch_size, 128), 1), 5000)');
    expect(migration).toContain("cron.schedule(");
    expect(migration).toContain("'cleanup-expired-rate-limits'");
    expect(reservation).not.toContain('PERFORM public.cleanup_expired_rate_limits');
    expect(migration).not.toMatch(/UPDATE public\.rate_limits\s+SET expires_at/);
    expect(migration).not.toContain('ALTER COLUMN expires_at SET NOT NULL');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.reserve_rate_limits');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.consume_rate_limit(');
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.consume_rate_limit[\s\S]*expires_at = CASE/,
    );
    expect(migration).toContain('LEAST(rl.hits, _limit) + 1');
    expect(migration).toContain('v_scope = ANY(v_seen_scopes)');
    expect(migration).toContain("v_ordinality = 1 AND v_scope <> 'ip'");
    expect(migration).toMatch(
      /IF v_hits > v_limit THEN\s+RETURN jsonb_build_object\(\s*'allowed', false,/,
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.reserve_rate_limits(jsonb) FROM PUBLIC, anon, authenticated',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.reserve_rate_limits(jsonb) TO service_role',
    );
  });

  it('prefers the gateway-owned Cloudflare address and otherwise uses the last proxy hop', () => {
    expect(requestIp(new Request('https://example.test', {
      headers: {
        'cf-connecting-ip': '203.0.113.10',
        'x-real-ip': '203.0.113.11',
        'x-forwarded-for': '198.51.100.1, 203.0.113.12',
      },
    }))).toBe('203.0.113.10');

    expect(requestIp(new Request('https://example.test', {
      headers: {
        'x-forwarded-for': 'attacker-controlled, 203.0.113.12',
      },
    }))).toBe('203.0.113.12');
  });
});
