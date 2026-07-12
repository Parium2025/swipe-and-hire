// Admin Alert Sender — routes system alerts via Lovable Emails.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "pariumab@hotmail.com";

interface AlertPayload {
  type: 'rss_source_failure' | 'system_critical' | 'storage_warning';
  source_name?: string;
  consecutive_failures?: number;
  error_message?: string;
  details?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
        idempotencyKey = `storage-${payload.details?.percentage}-${new Date().toISOString().slice(0, 10)}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Unknown alert type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'admin-alert',
        recipientEmail: ADMIN_EMAIL,
        idempotencyKey,
        templateData,
      },
    });

    if (error) {
      console.error("Failed to enqueue admin alert:", error);
      return new Response(
        JSON.stringify({ error: "Failed to enqueue alert", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Admin alert enqueued:", data);
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
