// Admin Alert Sender — routes system alerts via Lovable Emails.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireServiceRole } from "../_shared/service-auth.ts";
import { sendLoggedTemplateEmail } from '../_shared/transactional-email-templates/send-logged-email.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mottagare kan bytas utan kodändring via secret ADMIN_ALERT_EMAIL.
const ADMIN_EMAIL = Deno.env.get("ADMIN_ALERT_EMAIL") || "pariumab@hotmail.com";
// Hård global tak-spärr: max så här många larmmejl per dygn, oavsett typ.
// Skyddar både inkorgen och avsändarryktet mot larmstormar.
const MAX_ALERTS_PER_DAY = 20;

interface AlertPayload {
  type: 'rss_source_failure' | 'system_critical' | 'storage_warning' | 'news_watchdog' | 'cron_watchdog' | 'app_exception';
  source_name?: string;
  consecutive_failures?: number;
  error_message?: string;
  details?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const authResp = requireServiceRole(req, corsHeaders);
  if (authResp) return authResp;



  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload: AlertPayload = await req.json();
    console.log("Received alert:", payload);

    const timestamp = new Date().toLocaleString("sv-SE", {
      timeZone: "Europe/Stockholm",
      dateStyle: "short",
      timeStyle: "short",
    });

    let templateData: Record<string, any>;
    // Stabil nyckel per varningstyp — används för cooldown så samma larm
    // aldrig kan spamma inkorgen (och kön) flera gånger per period.
    let alertKey: string;
    let cooldownMinutes = 360; // 6 h standard
    let idempotencyKey: string;


    switch (payload.type) {
      case 'rss_source_failure':
        templateData = {
          alert_title: `RSS-källa nere: ${payload.source_name || 'okänd'}`,
          alert_emoji: '🔴',
          severity: 'warning',
          timestamp,
          summary: 'En RSS-källa har misslyckats flera gånger i rad. Kontrollera om URL:en ändrats eller om källan är tillfälligt nere.',
          fields: [
            { label: 'Källa', value: payload.source_name || '—' },
            { label: 'Konsekutiva fel', value: String(payload.consecutive_failures ?? '—') },
          ],
          error_message: payload.error_message || '',
        };
        alertKey = `rss-fail-${payload.source_name}`;
        cooldownMinutes = 720; // 12 h per källa
        idempotencyKey = `rss-fail-${payload.source_name}-${payload.consecutive_failures}`;

        break;

      case 'system_critical':
        templateData = {
          alert_title: payload.details?.message || 'Kritiskt systemfel',
          alert_emoji: '🚨',
          severity: 'critical',
          timestamp,
          summary: 'Ett kritiskt systemfel har inträffat. Undersök omedelbart.',
          fields: Object.entries(payload.details || {})
            .filter(([k]) => k !== 'message')
            .map(([k, v]) => ({ label: k, value: typeof v === 'string' ? v : JSON.stringify(v) })),
          error_message: payload.error_message || '',
        };
        alertKey = `system-critical-${payload.details?.message || 'unknown'}`.slice(0, 200);
        cooldownMinutes = 60;
        idempotencyKey = `system-critical-${Date.now()}`;

        break;

      case 'storage_warning':
        templateData = {
          alert_title: `Lagring: ${payload.details?.percentage ?? '?'}% använt`,
          alert_emoji: '⚠️',
          severity: 'warning',
          timestamp,
          summary: 'Överväg att uppgradera plan eller rensa gamla filer.',
          fields: [
            { label: 'Använt', value: `${payload.details?.percentage ?? '?'}%` },
            { label: 'Storlek', value: `${payload.details?.used ?? '?'} MB av ${payload.details?.limit ?? '?'} MB` },
          ],
        };
        alertKey = `storage-${payload.details?.percentage}`;
        cooldownMinutes = 1440; // 1 dygn
        idempotencyKey = `storage-${payload.details?.percentage}-${new Date().toISOString().slice(0, 10)}`;

        break;

      case 'news_watchdog':
        templateData = {
          alert_title: payload.details?.message || 'Nyhetsflödet behöver kontrolleras',
          alert_emoji: payload.details?.severity === 'critical' ? '🚨' : '⚠️',
          severity: payload.details?.severity === 'critical' ? 'critical' : 'warning',
          timestamp,
          summary: payload.details?.summary || 'Watchdoggen hittade ett problem i nyhetsflödet.',
          fields: Object.entries(payload.details || {})
            .filter(([k]) => !['message', 'summary', 'severity'].includes(k))
            .map(([k, v]) => ({ label: k, value: typeof v === 'string' ? v : JSON.stringify(v) })),
          error_message: payload.error_message || '',
        };
        alertKey = `news-watchdog-${payload.details?.feed || 'all'}-${payload.details?.code || 'check'}`;
        cooldownMinutes = 720; // 12 h per problemtyp och feed
        idempotencyKey = `news-watchdog-${new Date().toISOString().slice(0, 10)}-${payload.details?.feed || 'all'}-${payload.details?.code || 'check'}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Unknown alert type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    // Cooldown-spärr: samma larm kan bara mejlas en gång per period.
    // Detta är den enda vägen ut för admin-larm, så inget flöde kan spamma kön.
    const { data: claimed, error: claimError } = await supabase.rpc('claim_admin_alert', {
      _alert_key: alertKey,
      _cooldown_minutes: cooldownMinutes,
    });

    if (claimError) {
      console.error('Cooldown check failed, skipping alert to be safe:', claimError);
      return new Response(
        JSON.stringify({ success: false, skipped: 'cooldown_check_failed' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (claimed !== true) {
      console.log('Alert suppressed by cooldown:', alertKey);
      return new Response(
        JSON.stringify({ success: true, skipped: 'cooldown', alert_key: alertKey }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Global dygnsspärr — stoppar larmstormar även om nya larmtyper tillkommer.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: sentToday } = await supabase
      .from('email_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('template_name', 'admin-alert')
      .eq('status', 'sent')
      .gte('created_at', since);

    if ((sentToday ?? 0) >= MAX_ALERTS_PER_DAY) {
      console.warn('Daily admin alert cap reached, suppressing:', alertKey);
      return new Response(
        JSON.stringify({ success: true, skipped: 'daily_cap', alert_key: alertKey }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let data;
    try {
      data = await sendLoggedTemplateEmail('admin-alert', ADMIN_EMAIL, {
        idempotencyKey,
        templateData,
      });
    } catch (sendErr) {
      console.error("Failed to send admin alert:", sendErr);
      return new Response(
        JSON.stringify({ error: "Failed to send alert" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Admin alert sent:", data);
    return new Response(
      JSON.stringify({ success: true, ...data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("Error in send-admin-alert:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
