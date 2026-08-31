import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_FILE =
  'supabase/migrations/20260830120000_jobseeker_notes_server_revision_cas.sql';
const CONTRACT_FILE =
  'supabase/contract-migrations/20260830130000_jobseeker_notes_require_cas_writes.sql';
const migrationPath = resolve(process.cwd(), MIGRATION_FILE);
const contractPath = resolve(process.cwd(), CONTRACT_FILE);
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
const contractSql = existsSync(contractPath) ? readFileSync(contractPath, 'utf8') : '';

describe('jobseeker_notes server revision migration contract', () => {
  it('ships as a new additive migration', () => {
    expect(existsSync(migrationPath), `${MIGRATION_FILE} must exist`).toBe(true);
    expect(sql).toMatch(
      /alter\s+table\s+public\.jobseeker_notes[\s\S]*add\s+column\s+if\s+not\s+exists\s+revision\s+bigint/i,
    );
    expect(sql).toMatch(/alter\s+column\s+revision\s+set\s+default\s+1/i);
    expect(sql).toMatch(/check\s*\(\s*revision\s*>\s*0\s*\)/i);
  });

  it('makes revision server-owned and monotonic for every update', () => {
    expect(sql).toMatch(/new\.revision\s*:=\s*1/i);
    expect(sql).toMatch(
      /create\s+trigger\s+\w+[\s\S]*before\s+insert\s+on\s+public\.jobseeker_notes/i,
    );
    expect(sql).toMatch(/returns\s+trigger/i);
    expect(sql).toMatch(/new\.revision\s*:=\s*old\.revision\s*\+\s*1/i);
    expect(sql).toMatch(
      /create\s+trigger\s+\w+[\s\S]*before\s+update\s+on\s+public\.jobseeker_notes/i,
    );
  });

  it('implements an authenticated, row-locked compare-and-set RPC', () => {
    expect(sql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.save_jobseeker_note\s*\(\s*p_content\s+text\s*,\s*p_expected_revision\s+bigint\s*,\s*p_expected_user_id\s+uuid\s*\)/i,
    );
    expect(sql).toMatch(/security\s+definer/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*''/i);
    expect(sql).toMatch(/auth\.uid\s*\(\s*\)/i);
    expect(sql).toMatch(/p_expected_user_id\s+is\s+null[\s\S]*p_expected_user_id\s*<>\s*v_user_id/i);
    expect(sql).toMatch(/for\s+update/i);
    expect(sql).toMatch(/on\s+conflict\s*\(\s*user_id\s*\)\s+do\s+nothing/i);
    expect(sql).toMatch(/p_expected_revision\s*<>\s*v_server_revision/i);
  });

  it('returns the complete saved/already_saved/conflict server snapshot', () => {
    expect(sql).toMatch(/save_status\s+text/i);
    expect(sql).toMatch(/note_id\s+uuid/i);
    expect(sql).toMatch(/server_content\s+text/i);
    expect(sql).toMatch(/server_revision\s+bigint/i);
    expect(sql).toMatch(/server_updated_at\s+timestamptz/i);
    expect(sql).toContain("'saved'");
    expect(sql).toContain("'already_saved'");
    expect(sql).toContain("'conflict'");
  });

  it('exposes the RPC only to authenticated clients', () => {
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.save_jobseeker_note\s*\(\s*text\s*,\s*bigint\s*,\s*uuid\s*\)\s+from\s+public/i,
    );
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.save_jobseeker_note\s*\(\s*text\s*,\s*bigint\s*,\s*uuid\s*\)\s+from\s+anon/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.save_jobseeker_note\s*\(\s*text\s*,\s*bigint\s*,\s*uuid\s*\)\s+to\s+authenticated/i,
    );
  });

  it('keeps the expand migration compatible with legacy direct writers', () => {
    expect(sql).not.toMatch(
      /revoke\s+insert\s*,\s*update\s*,\s*delete\s*,\s*truncate\s+on\s+table\s+public\.jobseeker_notes\s+from\s+anon\s*,\s*authenticated/i,
    );
  });

  it('stages direct-write revocation as an explicitly blocked contract migration', () => {
    expect(existsSync(contractPath), `${CONTRACT_FILE} must exist`).toBe(true);
    expect(CONTRACT_FILE).toContain('contract-migrations/');
    expect(contractSql).toMatch(/blocked[\s\S]*do\s+not\s+move[\s\S]*frontend[\s\S]*verified[\s\S]*adopted/i);
    expect(contractSql).toMatch(
      /revoke\s+insert\s*,\s*update\s*,\s*delete\s*,\s*truncate\s+on\s+table\s+public\.jobseeker_notes\s+from\s+anon\s*,\s*authenticated/i,
    );
  });

  it('fails closed until objective contract-promotion evidence is filled in', () => {
    const preflightPosition = contractSql.search(/do\s+\$contract_preflight\$/i);
    const revokePosition = contractSql.search(/revoke\s+insert/i);
    expect(preflightPosition).toBeGreaterThanOrEqual(0);
    expect(revokePosition).toBeGreaterThan(preflightPosition);

    expect(contractSql).toMatch(/v_min_frontend_build\s+text\s*:=\s*null/i);
    expect(contractSql).toMatch(/v_min_frontend_commit\s+text\s*:=\s*null/i);
    expect(contractSql).toMatch(/v_observation_started_at\s+timestamptz\s*:=\s*null/i);
    expect(contractSql).toMatch(/v_observation_ended_at\s+timestamptz\s*:=\s*null/i);
    expect(contractSql).toMatch(/v_verified_cas_writes\s+bigint\s*:=\s*null/i);
    expect(contractSql).toMatch(/v_total_supported_writes\s+bigint\s*:=\s*null/i);
    expect(contractSql).toMatch(/v_supported_legacy_direct_writers\s+bigint\s*:=\s*null/i);
    expect(contractSql).toMatch(/v_approved_by\s+text\s*:=\s*null/i);
    expect(contractSql).toMatch(/raise\s+exception\s+'contract migration blocked:/i);
    expect(contractSql).toMatch(/v_observation_ended_at\s*-\s*v_observation_started_at\s*<\s*interval\s+'7 days'/i);
    expect(contractSql).toMatch(
      /clock_timestamp\(\)\s*-\s*v_observation_ended_at\s*>\s*interval\s+'24 hours'/i,
    );
    expect(contractSql).toMatch(
      /v_verified_cas_writes::numeric\s*\/\s*nullif\s*\(\s*v_total_supported_writes\s*,\s*0\s*\)\s*<\s*0\.999/i,
    );
    expect(contractSql).toMatch(/v_supported_legacy_direct_writers\s*<>\s*0/i);
  });

  it('documents an exact authenticated-only rollback for legacy writes', () => {
    expect(contractSql).toMatch(
      /rollback sql[\s\S]*grant\s+insert\s*,\s*update\s*,\s*delete\s+on\s+table\s+public\.jobseeker_notes\s+to\s+authenticated\s*;/i,
    );
  });

  it('bounds payload size and handles a disappeared row without false success', () => {
    expect(sql).toMatch(/octet_length\s*\(\s*v_content\s*\)\s*>\s*\d+/i);
    expect(sql).toMatch(
      /concurrent\s+first\s+insert[\s\S]*for\s+update\s*;[\s\S]*if\s+not\s+found\s+then[\s\S]*'conflict'/i,
    );
  });
});
