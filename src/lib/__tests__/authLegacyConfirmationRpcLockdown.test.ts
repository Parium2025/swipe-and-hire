import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const lockdownMigration =
  'supabase/migrations/20260830224500_legacy_confirmation_rpc_lockdown.sql';

describe('legacy confirmation RPC lockdown', () => {
  it('keeps the compatibility RPC service-role-only and never records raw capabilities', () => {
    const migration = read(lockdownMigration);

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.validate_confirmation_token(input_token uuid)',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.validate_confirmation_token(uuid) FROM PUBLIC, anon, authenticated',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.validate_confirmation_token(uuid) TO service_role',
    );
    expect(migration).toContain("pg_catalog.to_jsonb(ec) ->> 'email'");
    expect(migration).not.toContain('ec.email');
    expect(migration).not.toMatch(/['"]token['"]\s*,\s*input_token/);
    expect(migration).toMatch(/SET\s+metadata\s*=\s*COALESCE\(metadata,[\s\S]*\)\s*-\s*'token'/);
  });
});
