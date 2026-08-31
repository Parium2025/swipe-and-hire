import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const productionSource = () => {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(resolve(process.cwd(), directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') visit(path);
      } else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name)) {
        files.push(path);
      }
    }
  };

  visit('src');
  return files.map(read).join('\n');
};

const migrationFiles = () =>
  readdirSync(resolve(process.cwd(), 'supabase/migrations'))
    .filter((file) => file.endsWith('.sql'))
    .sort();

const profileHardeningMigration = () => {
  const file = migrationFiles().find((candidate) =>
    read(`supabase/migrations/${candidate}`).includes(
      'PROFILE_COLUMN_ACCESS_HARDENING_V1',
    ),
  );

  return file ? read(`supabase/migrations/${file}`) : null;
};

describe('profiles column-access security contracts', () => {
  it('removes table-wide SELECT and grants only an explicit safe allowlist', () => {
    const migration = profileHardeningMigration();

    expect(migration).not.toBeNull();
    expect(migration).toMatch(
      /REVOKE\s+SELECT\s+ON\s+(?:TABLE\s+)?public\.profiles\s+FROM\s+authenticated/i,
    );
    expect(migration).toMatch(
      /REVOKE\s+SELECT\s+ON\s+(?:TABLE\s+)?public\.profiles\s+FROM\s+anon/i,
    );
    expect(migration).toMatch(
      /GRANT\s+SELECT\s*\([\s\S]*?\)\s+ON\s+public\.profiles\s+TO\s+authenticated/i,
    );

    const grant = migration?.match(
      /GRANT\s+SELECT\s*\(([\s\S]*?)\)\s+ON\s+public\.profiles\s+TO\s+authenticated/i,
    )?.[1] ?? '';

    for (const required of [
      'user_id',
      'role',
      'first_name',
      'last_name',
      'company_name',
      'profile_image_url',
    ]) {
      expect(grant).toMatch(new RegExp(`\\b${required}\\b`, 'i'));
    }

    for (const sensitive of [
      'email',
      'phone',
      'birth_date',
      'address',
      'postal_code',
      'home_location',
      'cv_url',
      'video_url',
      'profile_file_name',
      'background_location_enabled',
      'last_active_at',
      'interview_video_link',
      'is_premium',
      'premium_until',
    ]) {
      expect(grant).not.toMatch(new RegExp(`\\b${sensitive}\\b`, 'i'));
    }
  });

  it('exposes colleague email only through a caller-derived organization RPC', () => {
    const migration = profileHardeningMigration();

    expect(migration).not.toBeNull();
    expect(migration).toContain('get_my_organization_member_profiles');
    expect(migration).toMatch(/role\s+text/i);
    expect(migration).toMatch(/SECURITY\s+DEFINER/i);
    expect(migration).toContain('auth.uid()');
    expect(migration).toMatch(/get_user_organization_id\s*\(\s*auth\.uid\(\)\s*\)/i);
    expect(migration).toMatch(/is_active\s+IS\s+TRUE/i);
    expect(migration).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.get_my_organization_member_profiles\(\)\s+FROM\s+PUBLIC\s*,\s*anon/i,
    );
    expect(migration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_my_organization_member_profiles\(\)\s+TO\s+authenticated/i,
    );

    const clientSources = [
      'src/lib/settingsPrewarm.ts',
      'src/components/TeamManagement.tsx',
    ].map(read).join('\n');
    expect(clientSources).toContain("rpc('get_my_organization_member_profiles'");
  });

  it('keeps employer applicant media on the existing caller-bound limited RPC', () => {
    const migrations = migrationFiles()
      .map((file) => read(`supabase/migrations/${file}`))
      .join('\n');
    const employerReadSources = [
      'src/lib/myCandidatesHydration.ts',
      'src/hooks/useApplicationsData.tsx',
      'src/hooks/useColleagueCandidates.ts',
      'src/hooks/useAuth.tsx',
      'src/hooks/useJobDetailsData.ts',
      'src/hooks/useCandidateBackgroundSync.ts',
      'src/hooks/usePrefetchApplications.ts',
    ].map(read).join('\n');

    expect(migrations).toContain('get_applicant_profile_media_batch');
    expect(migrations).toMatch(/auth\.uid\(\)\s*<>\s*p_employer_id/i);
    expect(migrations).toContain('authorized_applicants');
    expect(employerReadSources).toContain("rpc('get_applicant_profile_media_batch'");
    expect(employerReadSources).not.toContain("rpc('get_employer_applicant_profiles'");
  });

  it('does not read sensitive profile columns directly from the browser client', () => {
    const sources = productionSource();

    expect(sources).not.toMatch(
      /\.from\(['"]profiles['"]\)[\s\S]{0,220}?\.select\(['"][^'"]*\b(?:email|video_url|is_premium|premium_until)\b[^'"]*['"]\)/,
    );
    expect(sources).not.toMatch(
      /\.from\(['"]profiles['"]\)[\s\S]{0,220}?\.not\(['"](?:video_url|cv_url)['"]/,
    );
  });

  it('contains migration postconditions for both blocked and allowed columns', () => {
    const migration = profileHardeningMigration();

    expect(migration).not.toBeNull();
    expect(migration).toContain("has_table_privilege('authenticated', 'public.profiles', 'SELECT')");
    expect(migration).toContain("has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT')");
    expect(migration).toContain("has_column_privilege('authenticated', 'public.profiles', 'first_name', 'SELECT')");
  });

  it('uses the current platform-admin authority for admin-only profile operations', () => {
    const migration = profileHardeningMigration();

    expect(migration).not.toBeNull();
    expect(migration).toContain('is_platform_admin(auth.uid())');
    expect(migration).not.toContain('is_super_admin(auth.uid())');
  });

  it('drops the legacy public employer policy and never caches raw profile realtime rows', () => {
    const migration = profileHardeningMigration();
    const realtimeSources = [
      'src/components/CompanyProfileDialog.tsx',
      'src/hooks/useApplicationsData.tsx',
      'src/hooks/useMyCandidatesData.tsx',
      'src/components/SystemHealthPanel.tsx',
    ].map(read).join('\n');

    expect(migration).not.toBeNull();
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Public can view employer company info for job listings" ON public.profiles',
    );
    expect(migration).toContain('profile_change_signals');
    expect(migration).toContain('emit_profile_change_signal');
    expect(realtimeSources).not.toMatch(/table:\s*['"]profiles['"]/);
    expect(realtimeSources).not.toMatch(/setQueryData\([^;]*payload\.new/s);
  });
});
