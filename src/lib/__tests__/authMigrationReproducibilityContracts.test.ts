import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Auth migration reproducibility contracts', () => {
  it('defines the suppression table before creating indexes or trigger dependencies', () => {
    const migration = read(
      'supabase/migrations/20260830222000_auth_signup_consent_fail_closed.sql',
    );
    const tableDefinition = migration.indexOf(
      'CREATE TABLE IF NOT EXISTS public.suppressed_emails',
    );
    const indexDefinition = migration.indexOf(
      'CREATE INDEX IF NOT EXISTS suppressed_emails_normalized_email_idx',
    );

    expect(tableDefinition).toBeGreaterThan(-1);
    expect(indexDefinition).toBeGreaterThan(tableDefinition);
    expect(migration).toContain('UNIQUE (email)');
    expect(migration).toContain('ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY');
  });

  it('blocks signup enforcement unless auth.users invokes public.handle_new_user', () => {
    const migration = read(
      'supabase/contract-migrations/20260830224000_auth_signup_consent_enforcement.sql',
    );
    const triggerPreflight = migration.indexOf(
      'FROM pg_catalog.pg_trigger AS signup_trigger',
    );
    const enforcementDefinition = migration.indexOf(
      'CREATE OR REPLACE FUNCTION public.handle_new_user()',
    );

    expect(triggerPreflight).toBeGreaterThan(-1);
    expect(triggerPreflight).toBeLessThan(enforcementDefinition);
    expect(migration).toContain(
      "signup_trigger.tgrelid = 'auth.users'::regclass",
    );
    expect(migration).toContain('NOT signup_trigger.tgisinternal');
    expect(migration).toContain("signup_trigger.tgenabled IN ('O', 'A')");
    expect(migration).toContain('(signup_trigger.tgtype & 4) = 4');
    expect(migration).toContain('(signup_trigger.tgtype & 1) = 1');
    expect(migration).toContain("trigger_namespace.nspname = 'public'");
    expect(migration).toContain("trigger_function.proname = 'handle_new_user'");
    expect(migration).toContain(
      'Contract migration blocked: auth.users signup trigger is missing or misbound',
    );
    expect(migration).toContain('24500 and 25000');
    expect(migration).toContain('send-reset-password');
  });

  it('keeps already-applied migration history byte-for-byte immutable', () => {
    const migration = read(
      'supabase/migrations/20250922135201_9f2734c2-2005-449a-8da9-817cca685d2c.sql',
    );
    const digest = createHash('sha256').update(migration).digest('hex');

    expect(digest).toBe('cc8c37a63d6cb0c4260c417529967852b6287557f7ee43cd272916fda0b69a27');
  });
});
