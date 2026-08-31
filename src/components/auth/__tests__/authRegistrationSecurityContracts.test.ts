import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe.each(['src/components/AuthDesktop.tsx', 'src/components/AuthMobile.tsx'])(
  '%s registration contracts',
  (file) => {
    it('does not enumerate accounts before signup', () => {
      const source = read(file);
      expect(source).not.toContain('useEmailAvailability');
      expect(source).not.toContain('emailAvailability.taken');
    });

    it('enforces required phone validity, safe websites and the shared password floor', () => {
      const source = read(file);
      expect(source).toContain('validateSwedishPhoneNumber(jobSeekerData.phone, true)');
      expect(source).toContain('normalizeAuthWebsite(employerData.website)');
      expect(source).toContain('MIN_AUTH_PASSWORD_LENGTH');
      expect(source).toContain('AUTH_REGISTRATION_LIMITS');
      expect(source).toContain('maxLength={AUTH_REGISTRATION_LIMITS.email}');
      expect(source).toContain('maxLength={AUTH_REGISTRATION_LIMITS.password}');
      expect(source).toContain('maxLength={AUTH_REGISTRATION_LIMITS.website}');
      expect(source).not.toContain('currentPassword.length < 7');
      expect(source).not.toContain('minst 7 tecken');
      expect(source).not.toContain('onPaste={(e) => e.preventDefault()}');
      expect(source).not.toContain('onCopy={(e) => e.preventDefault()}');
    });
  },
);

describe('phone sign-in account-creation contract', () => {
  it('never lets the login-only SMS flow create a new auth user', () => {
    const source = read('src/hooks/useAuth.tsx');
    const phoneLogin = source.match(
      /const signInWithPhone[\s\S]*?const verifyOtp/,
    )?.[0];

    expect(phoneLogin).toBeTruthy();
    expect(phoneLogin).toContain('shouldCreateUser: false');
  });
});

describe('trusted signup provisioning contract', () => {
  it('accepts signup provisioning only from a server-controlled app-metadata marker', () => {
    const migration = read(
      'supabase/contract-migrations/20260830224000_auth_signup_consent_enforcement.sql',
    );

    expect(migration).toContain("new.raw_app_meta_data ->> 'parium_signup_channel'");
    expect(migration).toContain("v_signup_channel <> 'custom-signup-v1'");
    expect(migration).not.toContain(
      "new.raw_user_meta_data ->> 'parium_signup_channel'",
    );
  });
});
