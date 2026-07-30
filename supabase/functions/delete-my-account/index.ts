// GDPR "Right to erasure": self-service konto-radering.
// Vem som helst inloggad kan radera SITT EGET konto + all associerad data + storage.
// Ingen admin-behörighet krävs — men användaren måste vara inloggad (JWT valideras).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { purgeUserData } from '../_shared/user-purge.ts';


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

  try {
    const stats = await purgeUserData(admin, userId, email ?? null);
    console.log(`✅ Account ${userId} fully deleted`, stats);

    return new Response(
      JSON.stringify({ success: true, ...stats }),
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
