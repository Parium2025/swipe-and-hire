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
  return ((data ?? []) as unknown as Record<string, string>[]).map((r) => r.id).filter(Boolean);
}

/**
 * criterion_results hänger på candidate_evaluations via evaluation_id och har
 * ingen FK-cascade. Utan detta ligger AI:ns motivering om kandidaten kvar som
 * föräldralösa rader efter en "fullständig" radering.
 */
async function purgeCriterionResults(
  admin: SupabaseClient,
  column: 'applicant_id' | 'application_id' | 'evaluated_by',
  values: string[],
): Promise<void> {
  if (values.length === 0) return;
  const evalIds: string[] = [];
  for (const chunk of chunked(values)) {
    const { data, error } = await admin
      .from('candidate_evaluations')
      .select('id')
      .in(column, chunk);
    if (error) {
      console.warn('⚠️ list candidate_evaluations:', error.message);
      continue;
    }
    evalIds.push(...((data ?? []) as { id: string }[]).map((r) => r.id));
  }
  if (evalIds.length > 0) await delIn(admin, 'criterion_results', 'evaluation_id', evalIds);
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
  { table: 'user_onboarding_state', column: 'user_id' },
  { table: 'profile_cv_summaries', column: 'user_id' },
  // Kandidatprofiler (CV/video/bild-varianter). Cascade finns via auth.users,
  // men vi raderar explicit så att inget ligger kvar om auth-steget hoppas över.
  { table: 'candidate_profiles', column: 'user_id' },
  { table: 'user_data_consents', column: 'user_id' },
  // OBS: consent_records raderas INTE här. Raden pseudonymiseras i steg 8
  // nedan (e-post nollas) så att beviset för accepterade villkor finns kvar
  // enligt art. 17.3 e (rättsliga anspråk) utan att personuppgifter sparas.

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
  { table: 'candidate_evaluations', column: 'evaluated_by' },

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
  // deno-lint-ignore no-explicit-any
  admin: any,
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
    await purgeCriterionResults(admin, 'application_id', appIdsOnJobs);
    for (const table of APPLICATION_SCOPED) {
      if (appIdsOnJobs.length > 0) await delIn(admin, table, 'application_id', appIdsOnJobs);
    }
    // Chattar som hör till ansökningar på arbetsgivarens jobb ska bort helt —
    // annars kan meddelanden ligga kvar när annonsen och ansökan raderas.
    if (appIdsOnJobs.length > 0) {
      const jobConvIds: string[] = [];
      for (const chunk of chunked(appIdsOnJobs)) {
        const { data } = await admin.from('conversations').select('id').in('application_id', chunk);
        jobConvIds.push(...(data ?? []).map((r: { id: string }) => r.id));
      }
      if (jobConvIds.length > 0) {
        const msgIds: string[] = [];
        for (const chunk of chunked(jobConvIds)) {
          const { data } = await admin
            .from('conversation_messages')
            .select('id')
            .in('conversation_id', chunk);
          msgIds.push(...(data ?? []).map((r: { id: string }) => r.id));
        }
        if (msgIds.length > 0) await delIn(admin, 'conversation_message_reactions', 'message_id', msgIds);
        await delIn(admin, 'conversation_messages', 'conversation_id', jobConvIds);
        await delIn(admin, 'conversation_members', 'conversation_id', jobConvIds);
        await delIn(admin, 'conversations', 'id', jobConvIds);
      }
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
    // Anonym räknare per annons så att arbetsgivaren ser att antalet minskat
    // p.g.a. kontoradering (inga personuppgifter sparas).
    const perJob = new Map<string, number>();
    {
      const { data } = await admin
        .from('job_applications')
        .select('job_id')
        .eq('applicant_id', userId);
      for (const row of (data ?? []) as { job_id: string | null }[]) {
        if (row.job_id) perJob.set(row.job_id, (perJob.get(row.job_id) ?? 0) + 1);
      }
    }

    // Hämta jobbinfo innan ansökningar raderas så arbetsgivaren kan få en
    // notifikation om att kandidaten försvunnit (GDPR-anonym, inga personuppgifter).
    const jobIds = [...perJob.keys()];
    const { data: jobInfo } = await admin
      .from('job_postings')
      .select('id, employer_id, title')
      .in('id', jobIds);

    await purgeCriterionResults(admin, 'application_id', appIds);
    for (const table of APPLICATION_SCOPED) {
      await delIn(admin, table, 'application_id', appIds);
    }
    await delIn(admin, 'conversations', 'application_id', appIds);
    await del(admin, 'job_applications', 'applicant_id', userId);

    // Notifiera berörda arbetsgivare om att kandidaten försvunnit.
    // Ingen personlig data om kandidaten inkluderas — endast räknare och jobb.
    if (jobInfo && jobInfo.length > 0) {
      const now = new Date().toISOString();
      const notifications = jobInfo.map((job) => {
        const count = perJob.get(job.id) ?? 1;
        return {
          user_id: job.employer_id,
          type: 'candidate_deleted',
          title: 'Kandidat borttagen',
          body:
            count === 1
              ? `En kandidat har raderat sitt konto. En ansökan har tagits bort från ${job.title || 'din annons'}.`
              : `${count} kandidater har raderat sina konton. ${count} ansökningar har tagits bort från ${job.title || 'din annons'}.`,
          metadata: { job_id: job.id, route: '/my-jobs' },
          is_read: false,
          created_at: now,
        };
      });
      const { error: notifErr } = await admin.from('notifications').insert(notifications);
      if (notifErr) console.warn('⚠️ insert candidate_deleted notifications:', notifErr.message);
    }

    if (perJob.size > 0) {
      const { error: rpcErr } = await admin.rpc('increment_removed_applicants', {
        _job_ids: [...perJob.keys()],
        _counts: [...perJob.values()],
      });
      if (rpcErr) console.warn('⚠️ increment_removed_applicants:', rpcErr.message);
    }
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

  // 5. Kvarvarande AI-bedömningar om/av användaren (kan finnas utan ansökan kvar)
  await purgeCriterionResults(admin, 'applicant_id', [userId]);
  await purgeCriterionResults(admin, 'evaluated_by', [userId]);


  // 5b. Alla användarscopade tabeller (verifierade kolumnnamn)
  for (const { table, column } of USER_SCOPED) {
    await del(admin, table, column, userId);
  }

  // 6. Profil
  const { error: profileErr } = await admin.from('profiles').delete().eq('user_id', userId);
  if (profileErr) console.warn('⚠️ profiles:', profileErr.message);
  else stats.profile_deleted = true;

  // 7. Auth-kontot
  // Idempotent: om ett tidigare försök redan hann radera auth-kontot innan
  // runtimen dog ska återförsöket INTE fastna här — då skulle steg 8–10
  // (inaktivitetsnotiser, samtycken, e-postspår) aldrig köras.
  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    const msg = (authErr.message ?? '').toLowerCase();
    const alreadyGone =
      msg.includes('not found') || msg.includes('does not exist') ||
      (authErr as { status?: number }).status === 404;
    if (!alreadyGone) throw new Error(`Kunde inte radera auth-konto: ${authErr.message}`);
    console.warn('ℹ️ auth-konto redan raderat, fortsätter med resterande städning');
  }
  stats.auth_user_deleted = true;


  // 8. Inaktivitetsnotiser saknar FK-cascade → raden blir kvar som en
  //    föräldralös post med user_id + e-post. Ta bort den helt.
  await admin
    .from('account_inactivity_notices')
    .delete()
    .eq('user_id', userId);


  // Samtyckesbevis pseudonymiseras istället för att raderas: e-post och roll
  // nollas, kvar blir enbart vilken version som accepterades och när.
  // Rättslig grund: art. 17.3 e — nödvändigt för rättsliga anspråk.
  await admin
    .from('consent_records')
    .update({ email: null, role: null })
    .eq('user_id', userId);


  // 9. E-postbaserade spår (dessa tabeller saknar user_id)
  if (email) {
    const lower = email.toLowerCase();
    await del(admin, 'email_unsubscribe_tokens', 'email', lower);
    await del(admin, 'email_send_log', 'recipient_email', lower);
    await del(admin, 'outreach_dispatch_logs', 'recipient_email', lower);
  }


  // 10. VIKTIGT: adressen läggs INTE på suppressionslistan vid radering.
  // All data som kan generera utskick är borta i steg 1–9, och en spärr här
  // skulle blockera bekräftelsemejlet om personen registrerar sig på nytt
  // med samma adress (rätten att återkomma). Eventuell gammal spärr från
  // tidigare version rensas i custom-signup.
  if (email) {
    await admin
      .from('suppressed_emails')
      .delete()
      .eq('email', email.toLowerCase())
      .eq('reason', 'account_deleted');
  }

  return stats;
}
