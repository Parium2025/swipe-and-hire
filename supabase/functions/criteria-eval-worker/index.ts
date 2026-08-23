import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Bounded work per invocation ───────────────────────────────────────
const BATCH_SIZE = 8;          // candidates processed in parallel per batch
const MAX_BATCHES = 6;         // hard cap per invocation (48 candidates)
const MAX_HOPS = 60;           // depth budget across self-invocations
const HOP_COOLDOWN_MS = 1500;  // pause between self-invocations
const LEASE_SECONDS = 180;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let hop = 0;
  try {
    const body = await req.json().catch(() => ({}));
    hop = Number(body?.hop ?? 0);
  } catch {
    hop = 0;
  }

  if (hop >= MAX_HOPS) {
    console.log('criteria-eval-worker: hop budget spent, stopping chain');
    return json({ stopped: 'hop_budget' });
  }

  // ─── Single-flight: claim one run with a lease ───────────────────────
  const { data: claimed, error: claimError } = await supabase
    .rpc('claim_criteria_eval_run', { p_lease_seconds: LEASE_SECONDS });

  if (claimError) {
    console.error('claim_criteria_eval_run failed:', claimError.message);
    return json({ error: claimError.message }, 500);
  }

  const run = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!run?.run_id) {
    // Idle path: nothing to do → stop the chain, do NOT self-invoke.
    return json({ idle: true });
  }

  const runId: string = run.run_id;
  const jobId: string = run.job_id;
  let processed = 0;
  let rateLimitStrikes = 0;
  let paused: string | null = null;
  let remaining = true;

  for (let batch = 0; batch < MAX_BATCHES && !paused; batch++) {
    const { data: items, error: itemsError } = await supabase
      .rpc('claim_criteria_eval_items', { p_run_id: runId, p_limit: BATCH_SIZE });

    if (itemsError) {
      console.error('claim_criteria_eval_items failed:', itemsError.message);
      break;
    }
    if (!items || items.length === 0) {
      remaining = false;
      break;
    }

    const outcomes = await Promise.all(
      items.map(async (item: { item_id: string; applicant_id: string; application_id: string | null }) => {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/evaluate-candidate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              job_id: jobId,
              applicant_id: item.applicant_id,
              application_id: item.application_id,
            }),
          });

          if (res.ok) {
            await supabase.rpc('finish_criteria_eval_item', { p_item_id: item.item_id, p_ok: true });
            return { ok: true, status: res.status };
          }

          const text = await res.text().catch(() => '');
          await supabase.rpc('finish_criteria_eval_item', {
            p_item_id: item.item_id,
            p_ok: false,
            p_error: `${res.status}: ${text.slice(0, 300)}`,
          });
          return { ok: false, status: res.status };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await supabase.rpc('finish_criteria_eval_item', {
            p_item_id: item.item_id,
            p_ok: false,
            p_error: message.slice(0, 300),
          });
          return { ok: false, status: 0 };
        }
      }),
    );

    processed += outcomes.length;

    // ─── Circuit breaker ───────────────────────────────────────────────
    if (outcomes.some((o) => o.status === 402)) {
      paused = 'credits_exhausted';
    } else if (outcomes.some((o) => o.status === 403)) {
      paused = 'blocked';
    } else if (outcomes.filter((o) => o.status === 429).length > 0) {
      rateLimitStrikes += 1;
      if (rateLimitStrikes >= 3) {
        paused = 'rate_limited';
      } else {
        await sleep(2000 * rateLimitStrikes);
      }
    } else {
      rateLimitStrikes = 0;
    }
  }

  if (paused) {
    await supabase.rpc('pause_criteria_eval_run', { p_run_id: runId, p_reason: paused });
    console.warn(`criteria-eval-worker: paused run ${runId} (${paused})`);
    return json({ run_id: runId, processed, paused });
  }

  await supabase.rpc('release_criteria_eval_run', { p_run_id: runId });

  // ─── Gated next hop: only when unprocessed work remains ──────────────
  if (remaining) {
    const { count } = await supabase
      .from('criteria_eval_items')
      .select('id', { count: 'exact', head: true })
      .eq('run_id', runId)
      .in('status', ['pending', 'processing']);

    if ((count ?? 0) > 0) {
      await sleep(HOP_COOLDOWN_MS);
      fetch(`${supabaseUrl}/functions/v1/criteria-eval-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ hop: hop + 1 }),
      }).catch((e) => console.error('self-invoke failed:', e));
    }
  }

  return json({ run_id: runId, processed, hop });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
