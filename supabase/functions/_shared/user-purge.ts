// 🔒 GDPR art. 17 — EN gemensam, komplett radering av en användare.
//
// Varför denna fil finns:
// Databasen har INGA foreign keys med ON DELETE CASCADE i public-schemat.
// Alla barnrader måste därför raderas explicit — annars ligger kandidatdata
// (namn, betyg, anteckningar, AI-sammanfattningar, meddelanden) kvar efter en
// "fullständig radering".
//
// Använd ALLTID purgeUserData() vid kontoradering (självservice + inaktivitet).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { purgeUserStorage, USER_STORAGE_BUCKETS } from './storage-cleanup.ts';

const CHUNK = 100;

function chunked<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function del(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<void> {
  const { error } = await admin.from(table).delete().eq(column, value);
  if (error) console.warn(`⚠️ cleanup ${table}.${column}:`, error.message);
}

async function delIn(
  admin: SupabaseClient,
  table: string,
  column: string,
  values: string[],
): Promise<void> {
  for (const chunk of chunked(values)) {
    const { error } = await admin.from(table).delete().in(column, chunk);
    if (error) console.warn(`⚠️ cleanup ${table}.${column} (in):`, error.message);
  }
}

async function idsOf(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string,
  select = 'id',
): Promise<string[]> {
  const { data, error } = await admin.from(table).select(select).eq(column, value);
  if (error) {
    console.warn(`⚠️ list ${table}.${column}:`, error.message);
    return [];
  }
  return (data ?? []).map((r: Record<string, string>) => r.id).filter(Boolean);
}

/** Tabeller kopplade till ett jobb (job_id) — inga FK-cascades finns. */
const JOB_SCOPED: string[] = [
  'ai_usage_log',
  'candidate_evaluations',
  'candidate_notes',
  'candidate_ratings',
  'candidate_summaries',
  'criterion_feedback',
  'cv_analysis_queue',
  'interviews',
  'job_criteria',
  'job_questions',
  'job_stage_settings',
  'job_views',
  'my_candidates',
  'outreach_dispatch_logs',
  'profile_views',
  'saved_jobs',
  'swipe_actions',
  'job_applications',
];

/** Tabeller kopplade till en ansökan (application_id). */
const APPLICATION_SCOPED: string[] = [
  'candidate_evaluations',
  'candidate_summaries',
  'cv_analysis_queue',
  'interviews',
  'my_candidates',
  'profile_views',
];

/**
 * Rader där användaren är AKTÖR (skapare/ägare) eller SUBJEKT (kandidaten).
 * Kolumnnamnen är verifierade mot databasen — fel namn ger tyst kvarlämnad data.
 */
const USER_SCOPED: { table: string; column: string }[] = [
  // Jobbsökarens egna data
  { table: 'saved_jobs', column: 'user_id' },
  { table: 'swipe_actions', column: 'user_id' },
  { table: 'saved_searches', column: 'user_id' },
  { table: 'job_views', column: 'user_id' },
  { table: 'jobseeker_notes', column: 'user_id' },
  { table: 'profile_cv_summaries', column: 'user_id' },
  { table: 'user_data_consents', column: 'user_id' },
  { table: 'consent_records', column: 'user_id' },
  { table: 'user_stage_settings', column: 'user_id' },
  { table: 'user_roles', column: 'user_id' },
  { table: 'user_sessions', column: 'user_id' },
  { table: 'user_subscriptions', column: 'user_id' },
  { table: 'one_time_purchases', column: 'user_id' },
  { table: 'device_push_tokens', column: 'user_id' },
  { table: 'notification_preferences', column: 'user_id' },
  { table: 'notifications', column: 'user_id' },
  { table: 'email_confirmations', column: 'user_id' },
  { table: 'support_tickets', column: 'user_id' },
  { table: 'support_messages', column: 'user_id' },
  { table: 'company_reviews', column: 'user_id' },
  { table: 'company_reviews', column: 'hidden_author_id' },
  { table: 'app_exceptions', column: 'owner_user_id' },

  // Arbetsgivarens egna data
  { table: 'employer_notes', column: 'employer_id' },
  { table: 'employer_message_templates', column: 'employer_id' },
  { table: 'job_question_templates', column: 'employer_id' },
  { table: 'job_templates', column: 'employer_id' },
  { table: 'job_criteria', column: 'employer_id' },
  { table: 'outreach_automations', column: 'owner_user_id' },
  { table: 'outreach_templates', column: 'owner_user_id' },
  { table: 'outreach_dispatch_logs', column: 'owner_user_id' },
  { table: 'outreach_dispatch_logs', column: 'recipient_user_id' },

  // Kandidatdata som ligger hos rekryterare (subjekt = användaren)
  { table: 'candidate_notes', column: 'applicant_id' },
  { table: 'candidate_notes', column: 'employer_id' },
  { table: 'candidate_ratings', column: 'applicant_id' },
  { table: 'candidate_ratings', column: 'recruiter_id' },
  { table: 'candidate_activities', column: 'applicant_id' },
  { table: 'candidate_activities', column: 'user_id' },
  { table: 'candidate_evaluations', column: 'applicant_id' },
  { table: 'candidate_summaries', column: 'applicant_id' },
  { table: 'criterion_feedback', column: 'applicant_id' },
  { table: 'criterion_feedback', column: 'recruiter_id' },
  { table: 'cv_analysis_queue', column: 'applicant_id' },
  { table: 'my_candidates', column: 'applicant_id' },
  { table: 'my_candidates', column: 'recruiter_id' },
  { table: 'interviews', column: 'applicant_id' },
  { table: 'interviews', column: 'employer_id' },
  { table: 'profile_views', column: 'viewer_user_id' },
  { table: 'profile_views', column: 'viewed_user_id' },
  { table: 'profile_view_permissions', column: 'profile_id' },
  { table: 'profile_view_permissions', column: 'viewer_id' },
  { table: 'ai_usage_log', column: 'user_id' },
  { table: 'ai_usage_log', column: 'employer_id' },
  { table: 'ai_usage_log', column: 'applicant_id' },
];

export interface PurgeStats {
  storage_files_removed: number;
  jobs_deleted: number;
  applications_deleted: number;
  conversations_deleted: number;
  profile_deleted: boolean;
  auth_user_deleted: boolean;
}

/**
 * Raderar ALLT som hör till en användare: filer, jobb, ansökningar,
 * kandidatdata hos rekryterare, konversationer, profil och auth-kontot.
 */
export async function purgeUserData(
  admin: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<PurgeStats> {
  const stats: PurgeStats = {
    storage_files_removed: 0,
    jobs_deleted: 0,
    applications_deleted: 0,
    conversations_deleted: 0,
    profile_deleted: false,
    auth_user_deleted: false,
  };

  // 1. Storage — rekursivt + paginerat i alla buckets
  stats.storage_files_removed = await purgeUserStorage(admin, userId, USER_STORAGE_BUCKETS);

  // 2. Jobbannonser som arbetsgivare + allt som hänger på dem
  const jobIds = await idsOf(admin, 'job_postings', 'employer_id', userId);
  stats.jobs_deleted = jobIds.length;
  if (jobIds.length > 0) {
    // Ansökningar på dessa jobb → hämta deras id för ansökningsscopade rader
    const appIdsOnJobs: string[] = [];
    for (const chunk of chunked(jobIds)) {
      const { data } = await admin.from('job_applications').select('id').in('job_id', chunk);
      appIdsOnJobs.push(...(data ?? []).map((r: { id: string }) => r.id));
    }
    for (const table of APPLICATION_SCOPED) {
      if (appIdsOnJobs.length > 0) await delIn(admin, table, 'application_id', appIdsOnJobs);
    }
    // Konversationer kopplade till jobben
    for (const chunk of chunked(jobIds)) {
      await admin.from('conversations').update({ job_id: null }).in('job_id', chunk);
    }
    for (const table of JOB_SCOPED) {
      await delIn(admin, table, 'job_id', jobIds);
    }
    await delIn(admin, 'one_time_purchases', 'job_id', jobIds);
    await del(admin, 'job_postings', 'employer_id', userId);
  }

  // 3. Egna ansökningar som jobbsökare + allt som hänger på dem
  const appIds = await idsOf(admin, 'job_applications', 'applicant_id', userId);
  stats.applications_deleted = appIds.length;
  if (appIds.length > 0) {
    for (const table of APPLICATION_SCOPED) {
      await delIn(admin, table, 'application_id', appIds);
    }
    await delIn(admin, 'conversations', 'application_id', appIds);
    await del(admin, 'job_applications', 'applicant_id', userId);
  }

  // 4. Konversationer & meddelanden
  const convIds = new Set<string>();
  for (const [table, column] of [
    ['conversations', 'created_by'],
    ['conversations', 'candidate_id'],
  ] as const) {
    for (const id of await idsOf(admin, table, column, userId)) convIds.add(id);
  }
  {
    const { data } = await admin
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId);
    for (const row of (data ?? []) as { conversation_id: string }[]) {
      convIds.add(row.conversation_id);
    }
  }
  const convList = [...convIds];
  stats.conversations_deleted = convList.length;
  if (convList.length > 0) {
    // Reaktioner → meddelanden → medlemmar → konversation
    const msgIds: string[] = [];
    for (const chunk of chunked(convList)) {
      const { data } = await admin
        .from('conversation_messages')
        .select('id')
        .in('conversation_id', chunk);
      msgIds.push(...(data ?? []).map((r: { id: string }) => r.id));
    }
    if (msgIds.length > 0) await delIn(admin, 'conversation_message_reactions', 'message_id', msgIds);
    await delIn(admin, 'conversation_messages', 'conversation_id', convList);
    await delIn(admin, 'conversation_members', 'conversation_id', convList);
    await delIn(admin, 'conversations', 'id', convList);
  }
  await del(admin, 'conversation_messages', 'sender_id', userId);
  await del(admin, 'conversation_message_reactions', 'user_id', userId);
  await del(admin, 'conversation_members', 'user_id', userId);

  // 5. Alla användarscopade tabeller (verifierade kolumnnamn)
  for (const { table, column } of USER_SCOPED) {
    await del(admin, table, column, userId);
  }

  // 6. Profil
  const { error: profileErr } = await admin.from('profiles').delete().eq('user_id', userId);
  if (profileErr) console.warn('⚠️ profiles:', profileErr.message);
  else stats.profile_deleted = true;

  // 7. Auth-kontot
  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) throw new Error(`Kunde inte radera auth-konto: ${authErr.message}`);
  stats.auth_user_deleted = true;

  // 8. Anonymisera kvarvarande revisionsspår (får ej innehålla personuppgifter)
  await admin
    .from('account_inactivity_notices')
    .update({ email: null })
    .eq('user_id', userId);

  // 9. E-postbaserade spår (dessa tabeller saknar user_id)
  if (email) {
    const lower = email.toLowerCase();
    await del(admin, 'email_unsubscribe_tokens', 'email', lower);
    await del(admin, 'email_send_log', 'recipient_email', lower);
  }

  // 10. Suppression — förhindra oavsiktlig återkontakt
  if (email) {
    await admin.from('suppressed_emails').upsert(
      { email: email.toLowerCase(), reason: 'account_deleted' },
      { onConflict: 'email' },
    );
  }

  return stats;
}
