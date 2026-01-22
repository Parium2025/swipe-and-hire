// Admin Alert Sender - Notifies admin about system issues
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "pariumab@hotmail.com";
const FROM_EMAIL = "Parium System <noreply@parium.se>";

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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: AlertPayload = await req.json();
    console.log("Received alert:", payload);

    // Build email content based on alert type
    let subject: string;
    let htmlContent: string;

    const timestamp = new Date().toLocaleString("sv-SE", { 
      timeZone: "Europe/Stockholm",
      dateStyle: "short",
      timeStyle: "short"
    });

    switch (payload.type) {
      case 'rss_source_failure':
        subject = `⚠️ RSS-källa nere: ${payload.source_name}`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
              .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; }
              .header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #334155; }
              .icon { font-size: 32px; }
              h1 { margin: 0; font-size: 18px; color: #f97316; }
              .stat { background: #0f172a; padding: 12px; border-radius: 8px; margin-bottom: 12px; }
              .stat-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
              .stat-value { font-size: 20px; font-weight: 600; color: #fff; margin-top: 4px; }
              .error-box { background: #450a0a; border: 1px solid #991b1b; border-radius: 8px; padding: 12px; margin-top: 16px; }
              .error-text { color: #fca5a5; font-size: 13px; font-family: monospace; word-break: break-all; }
              .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #334155; font-size: 12px; color: #64748b; }
              .timestamp { color: #64748b; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <span class="icon">🔴</span>
                <div>
                  <h1>RSS-källa misslyckades</h1>
                  <span class="timestamp">${timestamp}</span>
                </div>
              </div>
              
              <div class="stat">
                <div class="stat-label">Källa</div>
                <div class="stat-value">${payload.source_name}</div>
              </div>
              
              <div class="stat">
                <div class="stat-label">Antal konsekutiva fel</div>
                <div class="stat-value" style="color: #f97316;">${payload.consecutive_failures}</div>
              </div>
              
              ${payload.error_message ? `
              <div class="error-box">
                <div class="stat-label" style="color: #fca5a5; margin-bottom: 8px;">Senaste felmeddelande</div>
                <div class="error-text">${payload.error_message}</div>
              </div>
              ` : ''}
              
              <div class="footer">
                <p>Detta är en automatisk notis från Parium systemövervakning.</p>
                <p>Åtgärd: Kontrollera om RSS-feedens URL har ändrats eller om källan är tillfälligt nere.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case 'system_critical':
        subject = `🚨 KRITISKT: ${payload.details?.message || 'Systemfel'}`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
              .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #dc2626; }
              h1 { margin: 0 0 16px; font-size: 18px; color: #dc2626; }
              .details { background: #0f172a; padding: 16px; border-radius: 8px; font-size: 14px; }
              .footer { margin-top: 20px; font-size: 12px; color: #64748b; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🚨 Kritiskt systemfel</h1>
              <p style="color: #94a3b8; font-size: 12px;">${timestamp}</p>
              <div class="details">
                <pre style="margin: 0; white-space: pre-wrap; color: #e2e8f0;">${JSON.stringify(payload.details, null, 2)}</pre>
              </div>
              <div class="footer">Automatisk notis från Parium.</div>
            </div>
          </body>
          </html>
        `;
        break;

      case 'storage_warning':
        subject = `⚠️ Lagring: ${payload.details?.percentage}% använt`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
              .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #f59e0b; }
              h1 { margin: 0 0 16px; font-size: 18px; color: #f59e0b; }
              .progress-bar { height: 20px; background: #334155; border-radius: 10px; overflow: hidden; margin: 16px 0; }
              .progress-fill { height: 100%; background: linear-gradient(90deg, #f59e0b, #dc2626); }
              .footer { margin-top: 20px; font-size: 12px; color: #64748b; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>⚠️ Lagringsvarning</h1>
              <p style="color: #94a3b8; font-size: 12px;">${timestamp}</p>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${payload.details?.percentage}%"></div>
              </div>
              <p style="text-align: center; font-size: 24px; font-weight: 600; color: #f59e0b;">${payload.details?.percentage}% använt</p>
              <p style="text-align: center; color: #94a3b8;">${payload.details?.used} MB av ${payload.details?.limit} MB</p>
              <div class="footer">
                <p>Åtgärd: Överväg att uppgradera till Lovable Pro eller rensa gamla filer.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Unknown alert type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Send email via Resend
    const resend = new Resend(RESEND_API_KEY);
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [ADMIN_EMAIL],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Alert email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Error in send-admin-alert:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
