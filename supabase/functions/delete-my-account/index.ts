// GDPR "Right to erasure": self-service konto-radering.
// Vem som helst inloggad kan radera SITT EGET konto + all associerad data + storage.
// Ingen admin-behörighet krävs — men användaren måste vara inloggad (JWT valideras).

import { createClient } from 'npm:@supabase/supabase-js@2';

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

  // 🔒 Validera användarens JWT först (kan INTE lita på klienten)
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
  const email = userData.user.email;
  console.log(`🗑️  Self-service account deletion started for user ${userId} (${email})`);

  // Kräv explicit bekräftelse i body (skydd mot råk-anrop)
  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ok — tom body faller igenom och blockas nedan
  }
  if (body?.confirm !== 'RADERA') {
    return new Response(
      JSON.stringify({
        error: 'Bekräftelse saknas. Skicka { "confirm": "RADERA" } för att bekräfta.',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const stats = {
    storage_files_removed: 0,
    jobs_deleted: 0,
    applications_deleted: 0,
    profile_deleted: false,
    auth_user_deleted: false,
  };

  try {
    // ============================================================
    // 1. Städa storage: ALLA filer (rekursivt + paginerat) i användarens mappar
    //    — bilder, profilvideo, cover-bilder, CV och bilagor.
    // ============================================================
    stats.storage_files_removed = await purgeUserStorage(
      admin,
      userId,
      USER_STORAGE_BUCKETS,
    );


    // ============================================================
    // 2. Räkna & radera jobbannonser (kaskaderar till frågor, kriterier osv.)
    // ============================================================
    const { count: jobCount } = await admin
      .from('job_postings')
      .select('id', { count: 'exact', head: true })
      .eq('employer_id', userId);
    stats.jobs_deleted = jobCount ?? 0;

    // Nolla FK-referenser utan CASCADE innan hard-delete
    if (stats.jobs_deleted > 0) {
      const { data: jobIds } = await admin
        .from('job_postings')
        .select('id')
        .eq('employer_id', userId);
      const ids = (jobIds ?? []).map((j) => j.id);
      if (ids.length > 0) {
        await admin.from('one_time_purchases').update({ job_id: null }).in('job_id', ids);
        await admin.from('candidate_ratings').update({ job_id: null }).in('job_id', ids);
        await admin.from('conversations').update({ job_id: null }).in('job_id', ids);
        await admin.from('outreach_dispatch_logs').update({ job_id: null }).in('job_id', ids);
        await admin.from('profile_views').update({ job_id: null }).in('job_id', ids);
      }
      await admin.from('job_postings').delete().eq('employer_id', userId);
    }

    // ============================================================
    // 3. Radera ansökningar som jobbsökare
    // ============================================================
    const { count: appCount } = await admin
      .from('job_applications')
      .select('id', { count: 'exact', head: true })
      .eq('applicant_id', userId);
    stats.applications_deleted = appCount ?? 0;
    await admin.from('job_applications').delete().eq('applicant_id', userId);

    // ============================================================
    // 4. Radera övrig användardata
    //    (tabeller som lagrar user_id och som inte kaskaderas via auth.users)
    // ============================================================
    const userScopedTables: { table: string; column: string }[] = [
      { table: 'saved_jobs', column: 'user_id' },
      { table: 'swipe_actions', column: 'user_id' },
      { table: 'candidate_notes', column: 'author_id' },
      { table: 'jobseeker_notes', column: 'jobseeker_id' },
      { table: 'employer_notes', column: 'author_id' },
      { table: 'candidate_ratings', column: 'employer_id' },
      { table: 'candidate_activities', column: 'user_id' },
      { table: 'device_push_tokens', column: 'user_id' },
      { table: 'notification_preferences', column: 'user_id' },
      { table: 'notifications', column: 'user_id' },
      { table: 'user_sessions', column: 'user_id' },
      { table: 'user_data_consents', column: 'user_id' },
      { table: 'saved_searches', column: 'user_id' },
      { table: 'user_subscriptions', column: 'user_id' },
      { table: 'profile_cv_summaries', column: 'user_id' },
      { table: 'profile_views', column: 'viewer_id' },
      { table: 'job_views', column: 'user_id' },
      { table: 'email_confirmations', column: 'user_id' },
      { table: 'email_unsubscribe_tokens', column: 'user_id' },
      { table: 'user_roles', column: 'user_id' },
      { table: 'conversation_members', column: 'user_id' },
      { table: 'conversation_message_reactions', column: 'user_id' },
      { table: 'criterion_feedback', column: 'author_id' },
    ];

    for (const { table, column } of userScopedTables) {
      const { error } = await admin.from(table).delete().eq(column, userId);
      if (error) {
        console.warn(`⚠️ Kunde inte städa ${table}.${column}:`, error.message);
      }
    }

    // ============================================================
    // 5. Radera profil (kan ha FK från meddelanden etc — kör sist)
    // ============================================================
    const { error: profileErr } = await admin
      .from('profiles')
      .delete()
      .eq('user_id', userId);
    if (!profileErr) stats.profile_deleted = true;
    else console.warn('⚠️ Profile delete:', profileErr.message);

    // ============================================================
    // 6. Radera auth-användaren (till sist)
    // ============================================================
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error('❌ auth.admin.deleteUser failed:', authErr);
      throw new Error(`Kunde inte radera auth-konto: ${authErr.message}`);
    }
    stats.auth_user_deleted = true;

    // ============================================================
    // 7. Suppression: förhindra oavsiktlig återkontakt via e-post
    // ============================================================
    if (email) {
      await admin.from('suppressed_emails').upsert(
        { email: email.toLowerCase(), reason: 'account_deleted' },
        { onConflict: 'email' },
      );
    }

    console.log(`✅ Account ${userId} fully deleted`, stats);

    return new Response(
      JSON.stringify({ success: true, ...stats }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('❌ delete-my-account error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, partial: stats }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
