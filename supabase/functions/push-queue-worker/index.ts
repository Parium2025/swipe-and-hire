// Köarbetare för pushnotiser.
//
// VARFÖR: när en ny annons publiceras kan tiotusentals bevakade sökningar
// träffa samtidigt. Tidigare skickades varje notis direkt i samma körning,
// vilket både slog i tidsgränsen och skickade alla pushar i samma sekund –
// och alla användare öppnade appen samtidigt. Nu läggs notiserna i kön
// push_notification_queue, utspridda över tid, och den här arbetaren betar
// av dem i jämn takt.
//
// Körs varje minut. Vid stor kö startar samordnaren flera parallella arbetare.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireServiceRoleOrCronSecret } from '../_shared/service-auth.ts';
import { getFcmAccessToken, sendFcmMessage, ServiceAccountCredentials } from '../_shared/fcm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Hur många notiser en arbetare plockar åt gången. */
const CLAIM_SIZE = 250;
/** Hur många enhetsutskick som pågår samtidigt hos en arbetare. */
const CONCURRENCY = 40;
/** Arbetaren avslutar i god tid så nästa minutkörning tar vid. */
const TIME_BUDGET_MS = 45_000;
/** Tak för antal parallella arbetare samordnaren startar. */
const MAX_WORKERS = 12;

/** Mappar data.type till rätt växel i notisinställningarna. */
const PREF_TYPE_ALIASES: Record<string, string> = {
  interview_reminder: 'interview_scheduled',
  interview_scheduled: 'interview_scheduled',
  new_application: 'new_application',
  new_message: 'new_message',
  saved_search_match: 'saved_search_match',
  job_closed: 'job_closed',
  job_expiring: 'job_closed',
  saved_job_expiring: 'saved_job_expiring',
  application_status: 'application_status',
};

interface QueueRow {
  id: number;
  recipient_id: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  notification_type: string | null;
  attempts: number;
}

/** Kör N uppgifter med ett tak på hur många som pågår samtidigt. */
async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await task(current);
    }
  });
  await Promise.all(runners);
}

async function runWorker(supabase: SupabaseClient, credentials: ServiceAccountCredentials) {
  const startedAt = Date.now();
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let batches = 0;

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const { data: claimed, error: claimError } = await supabase.rpc('claim_push_notifications', {
      p_limit: CLAIM_SIZE,
    });
    if (claimError) throw claimError;

    const rows = (claimed ?? []) as QueueRow[];
    if (rows.length === 0) break;
    batches++;

    // Inställningar för hela satsen i ETT anrop per notistyp i stället för
    // ett anrop per mottagare.
    const disabled = new Set<string>();
    const byPrefType = new Map<string, string[]>();
    for (const row of rows) {
      const raw = row.notification_type ?? row.data?.type ?? null;
      const prefType = raw ? PREF_TYPE_ALIASES[raw] ?? null : null;
      if (!prefType) continue;
      const list = byPrefType.get(prefType) ?? [];
      list.push(row.recipient_id);
      byPrefType.set(prefType, list);
    }
    for (const [prefType, userIds] of byPrefType) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('user_id, is_enabled')
        .eq('notification_type', prefType)
        .in('user_id', [...new Set(userIds)]);
      // Standard är påslaget – bara uttryckligt avstängt hoppas över.
      for (const p of prefs ?? []) {
        if ((p as { is_enabled: boolean | null }).is_enabled === false) {
          disabled.add(`${prefType}:${(p as { user_id: string }).user_id}`);
        }
      }
    }

    const deliverable = rows.filter((row) => {
      const raw = row.notification_type ?? row.data?.type ?? null;
      const prefType = raw ? PREF_TYPE_ALIASES[raw] ?? null : null;
      return !prefType || !disabled.has(`${prefType}:${row.recipient_id}`);
    });

    // Alla enhetstokens för hela satsen i ETT anrop.
    const recipientIds = [...new Set(deliverable.map((r) => r.recipient_id))];
    const tokensByUser = new Map<string, string[]>();
    if (recipientIds.length > 0) {
      const { data: tokenRows } = await supabase
        .from('device_push_tokens')
        .select('user_id, token')
        .eq('is_active', true)
        .in('user_id', recipientIds);
      for (const t of tokenRows ?? []) {
        const row = t as { user_id: string; token: string };
        const list = tokensByUser.get(row.user_id) ?? [];
        list.push(row.token);
        tokensByUser.set(row.user_id, list);
      }
    }

    const accessToken = await getFcmAccessToken(credentials);
    const projectId = credentials.project_id;

    const sentIds: number[] = [];
    const failedIds: number[] = [];
    const deadTokens = new Set<string>();
    let lastError: string | null = null;

    // Poster utan mottagbar kanal räknas som klara – de ska inte ligga kvar.
    const withoutTokens = deliverable.filter((r) => (tokensByUser.get(r.recipient_id) ?? []).length === 0);
    for (const row of withoutTokens) sentIds.push(row.id);
    for (const row of rows) {
      if (!deliverable.includes(row)) {
        sentIds.push(row.id);
        skippedCount++;
      }
    }

    const sendable = deliverable.filter((r) => (tokensByUser.get(r.recipient_id) ?? []).length > 0);
    await runWithConcurrency(sendable, CONCURRENCY, async (row) => {
      const tokens = tokensByUser.get(row.recipient_id) ?? [];
      let anyOk = false;
      for (const token of tokens) {
        const result = await sendFcmMessage(
          accessToken,
          projectId,
          token,
          row.title,
          row.body,
          row.data ?? {},
        );
        if (result.ok) {
          anyOk = true;
        } else if (result.unregistered) {
          deadTokens.add(token);
        } else {
          lastError = result.error ?? 'send failed';
        }
      }
      if (anyOk || tokens.every((t) => deadTokens.has(t))) {
        sentIds.push(row.id);
        if (anyOk) sentCount++;
      } else {
        failedIds.push(row.id);
        failedCount++;
      }
    });

    if (deadTokens.size > 0) {
      await supabase
        .from('device_push_tokens')
        .update({ is_active: false })
        .in('token', [...deadTokens]);
    }

    const { error: completeError } = await supabase.rpc('complete_push_notifications', {
      p_sent_ids: sentIds,
      p_failed_ids: failedIds,
      p_error: lastError,
    });
    if (completeError) {
      console.error('[push-queue-worker] Failed to mark batch complete:', completeError);
    }

    if (rows.length < CLAIM_SIZE) break;
  }

  return { sent: sentCount, skipped: skippedCount, failed: failedCount, batches };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authErr = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authErr) return authErr;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const isWorker = body?.worker === true;

    const fcmJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!fcmJson) {
      return new Response(
        JSON.stringify({ success: true, skipped: 'push_not_configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const credentials = JSON.parse(fcmJson) as ServiceAccountCredentials;

    if (isWorker) {
      const result = await runWorker(supabase, credentials);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Samordnare ──
    // Skala antalet arbetare efter hur mycket som faktiskt ligger och väntar.
    const { count } = await supabase
      .from('push_notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString());

    const pending = count ?? 0;
    if (pending === 0) {
      // Passa på att städa när kön ändå är tom.
      await supabase.rpc('cleanup_push_notification_queue');
      return new Response(JSON.stringify({ success: true, pending: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const workers = Math.max(1, Math.min(MAX_WORKERS, Math.ceil(pending / 1000)));
    const results = await Promise.allSettled(
      Array.from({ length: workers }, () =>
        supabase.functions.invoke('push-queue-worker', { body: { worker: true } }),
      ),
    );
    const failedWorkers = results.filter((r) => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({ success: true, pending, workers, failedWorkers }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[push-queue-worker] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
