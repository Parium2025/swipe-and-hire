// @vitest-environment node
// Execute the applied function in isolated PostgreSQL; never touch real accounts.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

const userId = '00000000-0000-0000-0000-000000000001';
const otherId = '00000000-0000-0000-0000-000000000002';
let db: PGlite;
const payload = { first_name: 'Första', interview_video_link: 'https://meet.google.com/abc-defg-hij' };
async function complete(profile = payload, prefs: Record<string, unknown> = {}) {
  const result = await db.query<{ result: string }>('SELECT public.complete_employer_welcome($1::jsonb,$2::jsonb) AS result', [JSON.stringify(profile), JSON.stringify(prefs)]);
  return result.rows[0]?.result;
}

describe('Atomic employer welcome completion', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''test.uid'',true),'''')::uuid';
      CREATE TABLE profiles(user_id uuid PRIMARY KEY,role text,organization_id uuid,joined_via_invite boolean,
        onboarding_completed boolean DEFAULT false,first_name text,last_name text,profile_image_url text,
        company_name text,company_logo_url text,industry text,employee_count text,address text,website text,company_description text,
        interview_video_link text,interview_video_default_message text,interview_default_message text,interview_office_address text,interview_office_instructions text,updated_at timestamptz);
      CREATE TABLE user_roles(user_id uuid,role text,organization_id uuid,is_active boolean);
      CREATE TABLE notification_preferences(user_id uuid,notification_type text,is_enabled boolean,email_enabled boolean,in_app_enabled boolean,updated_at timestamptz,UNIQUE(user_id,notification_type));`);
    await db.exec(readFileSync('drizzle/migrations/0080_atomic_employer_welcome_completion.sql', 'utf8'));
  }, 30000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`TRUNCATE profiles,user_roles,notification_preferences;
      SET test.uid='${userId}';
      INSERT INTO profiles(user_id,role,company_name,joined_via_invite) VALUES ('${userId}','employer','Företaget',false),('${otherId}','employer','Annat bolag',false);
      INSERT INTO user_roles VALUES ('${userId}','admin',null,true);`);
  });
  it('saves profile and explicit preferences together, preserving untouched defaults', async () => {
    expect(await complete(payload, { 'new_message:push': false })).toBe('completed');
    const result = await db.query('SELECT first_name,onboarding_completed FROM profiles WHERE user_id=$1', [userId]);
    expect(result.rows[0]).toEqual({ first_name: 'Första', onboarding_completed: true });
    const prefs = await db.query('SELECT is_enabled,email_enabled,in_app_enabled FROM notification_preferences');
    expect(prefs.rows[0]).toEqual({ is_enabled: false, email_enabled: false, in_app_enabled: true });
  });
  it('keeps the first successful submission when two calls arrive together', async () => {
    const results = await Promise.all([complete(payload, { 'new_message:email': true }), complete({ ...payload, first_name: 'Andra' }, { 'new_message:email': false })]);
    expect(results).toEqual(['completed', 'already_completed']);
    const profile = await db.query<{ first_name: string }>('SELECT first_name FROM profiles WHERE user_id=$1', [userId]);
    const prefs = await db.query<{ email_enabled: boolean }>('SELECT email_enabled FROM notification_preferences');
    expect(profile.rows[0]?.first_name).toBe('Första');
    expect(prefs.rows[0]?.email_enabled).toBe(true);
  });
  it('rolls back the profile if preference saving fails and permits a retry', async () => {
    await db.exec(`CREATE FUNCTION fail_pref() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$;
      CREATE TRIGGER fail_pref BEFORE INSERT ON notification_preferences FOR EACH ROW EXECUTE FUNCTION fail_pref();`);
    try {
      await expect(complete(payload, { 'new_message:email': true })).rejects.toThrow('test failure');
      const result = await db.query('SELECT onboarding_completed,first_name FROM profiles WHERE user_id=$1', [userId]);
      expect(result.rows[0]).toEqual({ onboarding_completed: false, first_name: null });
    } finally { await db.exec('DROP TRIGGER fail_pref ON notification_preferences; DROP FUNCTION fail_pref();'); }
    expect(await complete()).toBe('completed');
  });
  it('allows invited recruiters to save personal choices but not company identity', async () => {
    await db.exec(`UPDATE user_roles SET role='recruiter'; UPDATE profiles SET joined_via_invite=true WHERE user_id='${userId}';`);
    await expect(complete({ ...payload, company_name: 'Överskrivet' } as typeof payload)).rejects.toThrow('Company fields');
    expect(await complete(payload, { 'interview_response:in_app': true })).toBe('completed');
  });
  it('rejects a privileged field, locked preferences and inactive memberships', async () => {
    await expect(complete({ ...payload, onboarding_completed: true } as typeof payload)).rejects.toThrow('Unsupported profile field');
    await expect(complete(payload, { 'interview_scheduled:email': false })).rejects.toThrow('Invalid notification choice');
    await db.exec('UPDATE user_roles SET is_active=false');
    await expect(complete()).rejects.toThrow('Active employer membership');
  });
  it('does not write another account and rejects signed-out calls', async () => {
    await complete();
    const result = await db.query('SELECT onboarding_completed,first_name FROM profiles WHERE user_id=$1', [otherId]);
    expect(result.rows[0]).toEqual({ onboarding_completed: false, first_name: null });
    await db.exec("SET test.uid=''");
    await expect(complete()).rejects.toThrow('Authentication required');
  });
  it('requires a nonempty link before saving and keeps existing preference channels', async () => {
    await expect(complete({ ...payload, interview_video_link: '' })).rejects.toThrow('Video link required');
    await db.exec(`INSERT INTO notification_preferences VALUES ('${userId}','new_message',false,true,false,now());`);
    await complete(payload, { 'new_message:push': true });
    const prefs = await db.query('SELECT is_enabled,email_enabled,in_app_enabled FROM notification_preferences');
    expect(prefs.rows[0]).toEqual({ is_enabled: true, email_enabled: true, in_app_enabled: false });
  });
  it('holds a row lock before any write and never uses a check-then-save client sequence', () => {
    const sql = readFileSync('drizzle/migrations/0080_atomic_employer_welcome_completion.sql', 'utf8');
    expect(sql.indexOf('FOR UPDATE')).toBeLessThan(sql.indexOf("RETURN 'already_completed'"));
    expect(sql.indexOf("RETURN 'already_completed'")).toBeLessThan(sql.indexOf('UPDATE public.profiles SET'));
    const source = readFileSync('src/components/EmployerWelcomeTunnel.tsx', 'utf8');
    expect(source).toContain('completeEmployerWelcome({');
    expect(source).not.toContain('await updateProfile(');
    expect(source).toContain('event.key === welcomeCompletionKey(userId)');
    expect(source).toContain('if (!user?.id || isReplay) return');
  });
});