// GDPR "Right to erasure": self-service konto-radering.
// Inloggad användare raderar SITT EGET konto + all associerad data + storage.
//
// Arkitektur: raderingen läggs i en bakgrundskö (account_deletion_queue) och
// körs asynkront. Kontot spärras (ban) omedelbart så att åtkomsten upphör i
// samma sekund som begäran görs — även om själva purgen tar tid för konton
// med tusentals ansökningar. Cron-funktionen process-account-deletions är
// säkerhetsnätet som gör om försöket om edge-runtimen dör mitt i.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { purgeUserData } from '../_shared/user-purge.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: any;

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
  const email = userData.user.email ?? null;
  console.log('Self-service account deletion requested', { userId, hasEmail: !!email });

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

  try {
    // 1. Lägg i kön FÖRST — då är begäran spårbar även om något går fel sen.
    const { error: queueErr } = await admin
      .from('account_deletion_queue')
      .upsert(
        { user_id: userId, email, status: 'pending', last_error: null, completed_at: null },
        { onConflict: 'user_id' },
      );
    if (queueErr) throw new Error(`Kunde inte registrera raderingen: ${queueErr.message}`);

    // 2. Spärra kontot direkt + döda alla aktiva sessioner.
    //    Användaren kan inte logga in eller nå någon data medan purgen körs.
    const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    });
    if (banErr) console.warn('⚠️ ban user:', banErr.message);
    try {
      await admin.auth.admin.signOut(authHeader.replace('Bearer ', ''), 'global');
    } catch (e) {
      console.warn('⚠️ signOut:', (e as Error).message);
    }
    await admin.from('user_sessions').delete().eq('user_id', userId);

    // 3. Kör själva purgen i bakgrunden — svaret går tillbaka direkt.
    const runPurge = async () => {
      try {
        const stats = await purgeUserData(admin, userId, email);
        await admin
          .from('account_deletion_queue')
          .update({ status: 'completed', completed_at: new Date().toISOString(), last_error: null })
          .eq('user_id', userId);
        console.log(`✅ Account ${userId} fully deleted`, stats);
      } catch (err) {
        console.error('❌ background purge error:', err);
        await admin
          .from('account_deletion_queue')
          .update({ status: 'failed', last_error: (err as Error).message })
          .eq('user_id', userId);
      }
    };

    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // attempts räknas upp av kön när cron plockar den; markera som pågående
      await admin
        .from('account_deletion_queue')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('user_id', userId);
      EdgeRuntime.waitUntil(runPurge());
    } else {
      await runPurge();
    }

    return new Response(
      JSON.stringify({ success: true, queued: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('❌ delete-my-account error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
