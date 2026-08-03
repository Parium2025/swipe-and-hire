// 🧹 Bakgrundskö för kontoraderingar (GDPR art. 17).
//
// Plockar rader ur account_deletion_queue och kör purgeUserData. Detta är
// säkerhetsnätet bakom delete-my-account: om edge-runtimen dör mitt i en
// stor radering (tusentals ansökningar) återupptas den här inom 15 minuter.
// Misslyckade försök görs om upp till 5 gånger, sedan larmas admin.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireServiceRoleOrCronSecret } from '../_shared/service-auth.ts';
import { purgeUserData } from '../_shared/user-purge.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface QueueRow {
  user_id: string;
  email: string | null;
  attempts: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authResp) return authResp;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data, error } = await admin.rpc('claim_account_deletions', { _limit: 3 });
  if (error) {
    console.error('claim_account_deletions:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rows = (data ?? []) as QueueRow[];
  let completed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const stats = await purgeUserData(admin, row.user_id, row.email);
      await admin
        .from('account_deletion_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString(), last_error: null })
        .eq('user_id', row.user_id);
      completed++;
      console.log(`✅ queued deletion done ${row.user_id}`, stats);
    } catch (err) {
      failed++;
      const message = (err as Error).message;
      console.error(`❌ queued deletion failed ${row.user_id}:`, message);
      await admin
        .from('account_deletion_queue')
        .update({ status: 'failed', last_error: message })
        .eq('user_id', row.user_id);

      if (row.attempts >= 5) {
        try {
          await admin.functions.invoke('send-admin-alert', {
            body: {
              type: 'account_deletion_failed',
              title: 'Kontoradering misslyckades 5 gånger',
              message: `user_id ${row.user_id}: ${message}`,
            },
          });
        } catch (_) {
          // larmet får inte fälla körningen
        }
      }
    }
  }

  return new Response(JSON.stringify({ claimed: rows.length, completed, failed }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
