import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe.each([
  'supabase/functions/email-confirm/index.ts',
  'supabase/functions/redirect-confirm/index.ts',
])('retired confirmation redirect %s', (file) => {
  it('never reads or forwards bearer confirmation capabilities', () => {
    const code = source(file);

    expect(code).toContain('status: 410');
    expect(code).toContain('no-store');
    expect(code).toContain('no-referrer');
    expect(code).not.toContain('new URL(req.url)');
    expect(code).not.toContain('searchParams');
    expect(code).not.toContain('Location');
    expect(code).not.toContain('createClient');
  });
});
