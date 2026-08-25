// GDPR retention: raderar permanent jobbannonser som varit soft-deleted i > 90 dagar.
// Anropas nattligen av pg_cron. Endast service_role får trigga.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireServiceRoleOrCronSecret } from '../_shared/service-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 🔒 Endast service_role eller pg_cron får köra (skyddar mot masssraderingsattack)
  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authResp) return authResp;

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceKey,
  );


  const startedAt = Date.now();

  try {
    // 1. Kör RPC som hard-deletar jobb äldre än 90 dagar sedan soft-delete
    const { data: purgedRows, error: purgeErr } = await supabase.rpc(
      'purge_soft_deleted_jobs',
    );

    if (purgeErr) {
      console.error('❌ purge_soft_deleted_jobs failed:', purgeErr);
      return new Response(
        JSON.stringify({ error: purgeErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const purged = (purgedRows ?? []) as { purged_job_id: string; image_url: string | null }[];
    console.log(`🧹 Purged ${purged.length} soft-deleted jobs (> 90d old)`);

    // 2. Städa upp bildfiler i storage
    const paths: string[] = [];
    for (const row of purged) {
      if (!row.image_url) continue;
      // Extrahera path efter /job-images/
      const m = row.image_url.match(/\/job-images\/(.+)$/);
      if (m?.[1]) paths.push(m[1].split('?')[0]);
    }

    let removedImages = 0;
    if (paths.length > 0) {
      // Batcha i grupper om 100 (storage-API-gräns)
      for (let i = 0; i < paths.length; i += 100) {
        const batch = paths.slice(i, i + 100);
        const { data: rm, error: rmErr } = await supabase.storage
          .from('job-images')
          .remove(batch);
        if (rmErr) {
          console.error('⚠️ storage.remove failed:', rmErr);
        } else {
          removedImages += rm?.length ?? 0;
        }
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log(`✅ Purge done in ${durationMs}ms: ${purged.length} jobs, ${removedImages} images removed`);

    return new Response(
      JSON.stringify({
        success: true,
        purged_jobs: purged.length,
        removed_images: removedImages,
        duration_ms: durationMs,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('❌ purge-deleted-jobs unexpected error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
