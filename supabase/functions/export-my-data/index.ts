// GDPR art. 15 + 20: dataportabilitet.
// Inloggad användare laddar ner ALL sin egen data som maskinläsbar JSON.
// Ingen admin-behörighet krävs — men JWT valideras och exporten scopas
// hårt till den inloggade användarens egen data.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { listAllFilesRecursive, USER_STORAGE_BUCKETS } from '../_shared/storage-cleanup.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = userData.user.id;
  const admin = createClient(supabaseUrl, serviceKey);

  const grab = async (table: string, column: string) => {
    const { data, error } = await admin.from(table).select('*').eq(column, userId).limit(5000);
    if (error) {
      console.warn(`export ${table}.${column}:`, error.message);
      return [];
    }
    return data ?? [];
  };

  // Rekryterarförfattat material om kandidaten omfattas av art. 15, men får
  // inte röja VEM hos arbetsgivaren som skrivit det (den personens egna
  // personuppgifter). Därför strippas identifierande motpartskolumner.
  const REDACTED = [
    'recruiter_id',
    'employer_id',
    'evaluated_by',
    'user_id',
    'viewer_user_id',
    'viewer_org_id',
    'organization_id',
    'owner_user_id',
  ];
  const grabAbout = async (table: string, column: string) => {
    const rows = await grab(table, column);
    return (rows as Record<string, unknown>[]).map((row) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!REDACTED.includes(k)) clean[k] = v;
      }
      return clean;
    });
  };


  try {
    const [
      profile,
      roles,
      applications,
      savedJobs,
      savedSearches,
      swipes,
      jobs,
      notifications,
      notificationPrefs,
      consents,
      cvSummaries,
      interviewsAsCandidate,
      interviewsAsEmployer,
      subscriptions,
      memberships,
      pushDevices,
      purchases,
      supportTickets,
      supportMessages,
      reviews,
      notesAboutMe,
      ratingsAboutMe,
      evaluationsAboutMe,
      summariesAboutMe,
      criterionFeedbackAboutMe,
      activityAboutMe,
      pipelineEntries,
      profileViewsOfMe,
    ] = await Promise.all([
      grab('profiles', 'user_id'),
      grab('user_roles', 'user_id'),
      grab('job_applications', 'applicant_id'),
      grab('saved_jobs', 'user_id'),
      grab('saved_searches', 'user_id'),
      grab('swipe_actions', 'user_id'),
      grab('job_postings', 'employer_id'),
      grab('notifications', 'user_id'),
      grab('notification_preferences', 'user_id'),
      grab('consent_records', 'user_id'),
      grab('profile_cv_summaries', 'user_id'),
      grab('interviews', 'applicant_id'),
      grab('interviews', 'employer_id'),
      grab('user_subscriptions', 'user_id'),
      grab('conversation_members', 'user_id'),
      grab('device_push_tokens', 'user_id'),
      grab('one_time_purchases', 'user_id'),
      grab('support_tickets', 'user_id'),
      grab('support_messages', 'user_id'),
      grab('company_reviews', 'user_id'),
      // Material som arbetsgivare registrerat OM användaren (art. 15.1)
      grabAbout('candidate_notes', 'applicant_id'),
      grabAbout('candidate_ratings', 'applicant_id'),
      grabAbout('candidate_evaluations', 'applicant_id'),
      grabAbout('candidate_summaries', 'applicant_id'),
      grabAbout('criterion_feedback', 'applicant_id'),
      grabAbout('candidate_activities', 'applicant_id'),
      grabAbout('my_candidates', 'applicant_id'),
      grabAbout('profile_views', 'viewed_user_id'),
    ]);


    // Meddelanden: bara de användaren själv har skrivit
    const { data: messages } = await admin
      .from('conversation_messages')
      .select('id, conversation_id, content, created_at, edited_at, attachment_name')
      .eq('sender_id', userId)
      .limit(10000);

    // Egna anteckningar (jobbsökare/arbetsgivare) + övriga egna spår som
    // också är personuppgifter enligt art. 15 (visningshistorik, samtycken,
    // egna kolumninställningar och utskickade inaktivitetsvarningar).
    const [
      personalNotes,
      employerNotes,
      jobViews,
      dataConsents,
      stageSettings,
      inactivityNotices,
    ] = await Promise.all([
      grab('jobseeker_notes', 'user_id'),
      grab('employer_notes', 'employer_id'),
      grab('job_views', 'user_id'),
      grab('user_data_consents', 'user_id'),
      grab('user_stage_settings', 'user_id'),
      grab('account_inactivity_notices', 'user_id'),
    ]);


    // Uppladdade filer (CV, bilder, video, bilagor) — art. 20 gäller även
    // filerna, inte bara databasraderna. Länkarna är tidsbegränsade (1 timme).
    // Samma rekursiva + paginerade listning som raderingen använder, annars
    // missas filer i undermappar (userId/cv/fil.pdf) och konton med >1000 filer.
    const files: { bucket: string; path: string; download_url: string | null }[] = [];
    for (const bucket of USER_STORAGE_BUCKETS) {
      const paths = await listAllFilesRecursive(admin, bucket, userId);
      for (const path of paths) {
        const { data: signed } = await admin.storage.from(bucket).createSignedUrl(path, 3600);
        files.push({ bucket, path, download_url: signed?.signedUrl ?? null });
      }
    }



    const payload = {
      export_metadata: {
        generated_at: new Date().toISOString(),
        format: 'application/json',
        legal_basis: 'GDPR art. 15 (rätt till tillgång) & art. 20 (dataportabilitet)',
        controller: 'Parium AB',
        contact: 'support@parium.se',
      },
      account: {
        id: userId,
        email: userData.user.email,
        created_at: userData.user.created_at,
        last_sign_in_at: userData.user.last_sign_in_at,
        provider: userData.user.app_metadata?.provider,
        terms_accepted_at: userData.user.user_metadata?.terms_accepted_at ?? null,
      },
      profile,
      roles,
      consent_log: consents,
      job_applications: applications,
      saved_jobs: savedJobs,
      saved_searches: savedSearches,
      swipe_actions: swipes,
      job_postings: jobs,
      interviews: [...interviewsAsCandidate, ...interviewsAsEmployer],
      conversations: memberships,
      messages_sent: messages ?? [],
      notifications,
      notification_preferences: notificationPrefs,
      cv_analyses: cvSummaries,
      subscriptions,
      purchases,
      push_devices: pushDevices,
      support_tickets: supportTickets,
      support_messages: supportMessages,
      company_reviews: reviews,
      personal_notes: personalNotes,
      employer_notes: employerNotes,
      uploaded_files: files,

      // Uppgifter som arbetsgivare registrerat om dig. Vem hos arbetsgivaren
      // som skrivit posten är utelämnat — det är den personens personuppgift.
      employer_records_about_me: {
        notes: notesAboutMe,
        ratings: ratingsAboutMe,
        evaluations: evaluationsAboutMe,
        ai_summaries: summariesAboutMe,
        criterion_feedback: criterionFeedbackAboutMe,
        activity_log: activityAboutMe,
        pipeline_entries: pipelineEntries,
        profile_views: profileViewsOfMe,
      },
    };


    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="parium-mina-uppgifter-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error('export-my-data error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
