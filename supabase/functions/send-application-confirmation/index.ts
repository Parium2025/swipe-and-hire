import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApplicationConfirmationRequest {
  applicant_email: string;
  applicant_first_name: string;
  job_title: string;
  company_name: string;
  application_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicant_email, applicant_first_name, job_title, company_name, application_id }: ApplicationConfirmationRequest = await req.json();

    // 1) First try outreach automation
    const dispatchResponse = await fetch(`${supabaseUrl}/functions/v1/outreach-dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ trigger: "application_received" }),
    });

    if (dispatchResponse.ok) {
      const dispatchData = await dispatchResponse.json().catch(() => ({}));
      const processedCount = Number(dispatchData?.processedCount ?? 0);
      if (processedCount > 0) {
        return new Response(JSON.stringify({ success: true, processedCount, mode: "outreach_automation" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // 2) Respect user's email notification preference
    try {
      const { data: allowed } = await supabaseAdmin.rpc('is_email_notification_enabled', {
        p_email: applicant_email,
        p_type: 'application_status',
      });
      if (allowed === false) {
        console.log(`Skipping application confirmation email for ${applicant_email} (email pref off)`);
        return new Response(JSON.stringify({ success: true, skipped: 'email_disabled' }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    } catch (prefErr) {
      console.warn('Preference check failed, defaulting to send:', prefErr);
    }

    // 3) Send via Lovable Emails (send-transactional-email)
    const idempotencyKey = `app-confirm-${application_id || applicant_email}-${job_title}`.slice(0, 200);

    const { data, error } = await supabaseAdmin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'application-confirmation',
        recipientEmail: applicant_email,
        idempotencyKey,
        templateData: {
          applicant_first_name,
          job_title,
          company_name,
        },
      },
    });

    if (error) {
      console.error("Failed to enqueue application confirmation:", error);
      return new Response(
        JSON.stringify({ error: error.message || 'send-transactional-email failed' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Application confirmation enqueued:", data);

    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending application confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
