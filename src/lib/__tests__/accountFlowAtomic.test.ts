// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
const uid='00000000-0000-0000-0000-000000000001', other='00000000-0000-0000-0000-000000000002', org='00000000-0000-0000-0000-000000000003', org2='00000000-0000-0000-0000-000000000004';
let db: PGlite;
const welcome=(name:string)=>db.query<{result:string}>('SELECT complete_jobseeker_welcome($1::jsonb,true) result',[JSON.stringify({first_name:name,profile_file_name:'CV.pdf',interests:['Teknik']})]);
const accept=(token='token',email='person@example.test')=>db.query<{result:{success?:boolean;code?:string;alreadyMember?:boolean}}>('SELECT accept_team_invitation($1,$2,$3) result',[uid,email,token]);
describe('Repeated account flows in isolated PostgreSQL',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''test.uid'',true),'''')::uuid';
CREATE TABLE profiles(user_id uuid PRIMARY KEY,role text,organization_id uuid,joined_via_invite boolean DEFAULT false,onboarding_completed boolean DEFAULT false,first_name text,last_name text,bio text,location text,city text,postal_code text,phone text,birth_date date,employment_type text,work_schedule text,availability text,interests text[],cv_url text,profile_file_name text,profile_image_url text,video_url text,cover_image_url text,company_name text,updated_at timestamptz);
CREATE TABLE user_data_consents(user_id uuid UNIQUE,consent_given boolean,consent_date timestamptz,updated_at timestamptz);
CREATE TABLE organizations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text);
CREATE TABLE user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,organization_id uuid,role text,is_active boolean,created_at timestamptz DEFAULT now(),updated_at timestamptz);
CREATE TABLE organization_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),token_hash text UNIQUE,organization_id uuid,email text,role text,status text DEFAULT 'pending',expires_at timestamptz DEFAULT now()+interval '7 days',accepted_by uuid,accepted_at timestamptz,updated_at timestamptz);
CREATE FUNCTION copy_org_company_fields_to_member(uuid,uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF current_setting('test.fail_copy',true)='yes' THEN RAISE EXCEPTION 'copy failure'; END IF; END $$;`);
  await db.exec(readFileSync('drizzle/migrations/0081_atomic_jobseeker_welcome_completion.sql','utf8'));
  await db.exec(readFileSync('drizzle/migrations/0082_atomic_team_accept_and_workspace.sql','utf8'));
 },30000);
 afterAll(async()=>{await db?.close();});
 beforeEach(async()=>{await db.exec(`TRUNCATE profiles,user_roles,user_data_consents,organizations,organization_invitations; SET test.uid='${uid}'; SET test.fail_copy='no'; INSERT INTO profiles(user_id,role,company_name) VALUES('${uid}','job_seeker','Företag'),('${other}','job_seeker','Annat'); INSERT INTO organizations VALUES('${org}','Organisation'),('${org2}','Annat'); INSERT INTO organization_invitations(token_hash,organization_id,email,role) VALUES('token','${org}','person@example.test','recruiter');`);});
 it('keeps first jobseeker save through 1000 queued attempts',async()=>{
  const results=await Promise.all(Array.from({length:1000},(_,i)=>welcome(`Person ${i}`)));
  expect(results.filter(r=>r.rows[0]?.result==='completed')).toHaveLength(1);
  expect(results.filter(r=>r.rows[0]?.result==='already_completed')).toHaveLength(999);
  expect((await db.query('SELECT first_name,profile_file_name,interests FROM profiles WHERE user_id=$1',[uid])).rows[0]).toEqual({first_name:'Person 0',profile_file_name:'CV.pdf',interests:['Teknik']});
  expect((await db.query('SELECT count(*)::int total FROM user_data_consents')).rows[0]).toEqual({total:1});
 },30000);
 it('rolls back profile if consent fails, then retries',async()=>{
  await db.exec(`CREATE FUNCTION fail_consent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'consent failure'; END $$; CREATE TRIGGER fail_consent BEFORE INSERT ON user_data_consents FOR EACH ROW EXECUTE FUNCTION fail_consent();`);
  try{await expect(welcome('Ej sparat')).rejects.toThrow('consent failure'); expect((await db.query('SELECT onboarding_completed FROM profiles WHERE user_id=$1',[uid])).rows[0]).toEqual({onboarding_completed:false});}
  finally{await db.exec('DROP TRIGGER fail_consent ON user_data_consents; DROP FUNCTION fail_consent();');}
  expect((await welcome('Sparat')).rows[0]?.result).toBe('completed');
 });
 it('rejects privileged fields, signed-out and employer use',async()=>{
  await expect(db.query('SELECT complete_jobseeker_welcome($1::jsonb,true)',[JSON.stringify({organization_id:org})])).rejects.toThrow('Unsupported profile field');
  await db.exec("SET test.uid=''"); await expect(welcome('Ingen')).rejects.toThrow('Authentication required');
  await db.exec(`SET test.uid='${uid}'; UPDATE profiles SET role='employer' WHERE user_id='${uid}'`); await expect(welcome('Fel')).rejects.toThrow('Jobseeker profile required');
 });
 it('leaves other account untouched',async()=>{
  await welcome('Första'); expect((await db.query('SELECT onboarding_completed,first_name FROM profiles WHERE user_id=$1',[other])).rows[0]).toEqual({onboarding_completed:false,first_name:null});
 });
 it('creates one membership through 1000 queued invite replays',async()=>{
  await db.exec(`UPDATE profiles SET role='employer' WHERE user_id='${uid}'`);
  const results=await Promise.all(Array.from({length:1000},()=>accept()));
  expect(results.every(r=>r.rows[0]?.result.success)).toBe(true); expect(results.filter(r=>r.rows[0]?.result.alreadyMember)).toHaveLength(999);
  expect((await db.query('SELECT count(*)::int total FROM user_roles')).rows[0]).toEqual({total:1});
  expect((await db.query('SELECT organization_id,joined_via_invite FROM profiles WHERE user_id=$1',[uid])).rows[0]).toEqual({organization_id:org,joined_via_invite:true});
 },30000);
 it('rolls back membership, profile and claim on copy failure',async()=>{
  await db.exec(`UPDATE profiles SET role='employer' WHERE user_id='${uid}'; SET test.fail_copy='yes'`); await expect(accept()).rejects.toThrow('copy failure');
  expect((await db.query('SELECT count(*)::int total FROM user_roles')).rows[0]).toEqual({total:0}); expect((await db.query('SELECT status FROM organization_invitations')).rows[0]).toEqual({status:'pending'});
  expect((await db.query('SELECT organization_id FROM profiles WHERE user_id=$1',[uid])).rows[0]).toEqual({organization_id:null});
  await db.exec("SET test.fail_copy='no'"); expect((await accept()).rows[0]?.result.success).toBe(true);
 });
 it('rejects competing organization and preserves admin role',async()=>{
  await db.exec(`UPDATE profiles SET role='employer' WHERE user_id='${uid}'; INSERT INTO organization_invitations(token_hash,organization_id,email,role) VALUES('token2','${org2}','person@example.test','admin');`);
  const results=await Promise.all([accept(),accept('token2')]); expect(results[0].rows[0]?.result.success).toBe(true); expect(results[1].rows[0]?.result.code).toBe('other_org');
  await db.exec(`UPDATE user_roles SET role='admin'; INSERT INTO organization_invitations(token_hash,organization_id,email,role) VALUES('token3','${org}','person@example.test','recruiter');`); await accept('token3'); expect((await db.query('SELECT role FROM user_roles')).rows[0]).toEqual({role:'admin'});
 });
 it('rejects wrong email, revoked and expired links',async()=>{
  await db.exec(`UPDATE profiles SET role='employer' WHERE user_id='${uid}'`); expect((await accept('token','wrong@example.test')).rows[0]?.result.code).toBe('wrong_email');
  await db.exec("UPDATE organization_invitations SET status='revoked'"); expect((await accept()).rows[0]?.result.code).toBe('revoked');
  await db.exec("UPDATE organization_invitations SET status='pending',expires_at=now()-interval '1 second'"); expect((await accept()).rows[0]?.result.code).toBe('expired');
  expect((await db.query('SELECT count(*)::int total FROM user_roles')).rows[0]).toEqual({total:0});
 });
 it('creates one workspace on repeated confirmations and skips invitees',async()=>{
  await db.exec("UPDATE profiles SET role='employer'");
  await Promise.all(Array.from({length:100},()=>db.query('SELECT provision_confirmed_employer_workspace($1,$2)',[uid,'person@example.test']))); expect((await db.query('SELECT count(*)::int total FROM user_roles')).rows[0]).toEqual({total:0});
  await Promise.all(Array.from({length:100},()=>db.query('SELECT provision_confirmed_employer_workspace($1,$2)',[other,'other@example.test']))); expect((await db.query('SELECT count(*)::int total FROM user_roles')).rows[0]).toEqual({total:1}); expect((await db.query('SELECT count(*)::int total FROM organizations')).rows[0]).toEqual({total:3});
 });
 it('keeps privileged functions service-only',async()=>{
  expect((await db.query("SELECT has_function_privilege('authenticated','accept_team_invitation(uuid,text,text)','execute') accept,has_function_privilege('anon','provision_confirmed_employer_workspace(uuid,text)','execute') provision")).rows[0]).toEqual({accept:false,provision:false});
 });
});
