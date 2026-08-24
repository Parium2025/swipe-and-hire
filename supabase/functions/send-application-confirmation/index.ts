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

import { verifyCaller } from "../_shared/service-auth.ts";
import { sendLoggedTemplateEmail } from '../_shared/transactional-email-templates/send-logged-email.ts'

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTH: cryptographically verify caller. Lock recipient to caller's email. ===
    const caller = await verifyCaller(req, corsHeaders);
    if (caller instanceof Response) return caller;
    const isServiceRole = caller.isServiceRole;
    const callerEmail = caller.email;


    const { applicant_email, applicant_first_name, job_title, company_name, application_id }: ApplicationConfirmationRequest = await req.json();

    // Prevent using this endpoint to send confirmation to arbitrary addresses.
    if (!isServiceRole && callerEmail && applicant_email && applicant_email.toLowerCase() !== callerEmail) {
      return new Response(JSON.stringify({ error: "Recipient must match caller" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }


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
        console.log('Skipping application confirmation email because preference is off');
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

    let data;
    try {
      data = await sendLoggedTemplateEmail('application-confirmation', applicant_email, {
        idempotencyKey,
        templateData: {
          applicant_first_name,
          job_title,
          company_name,
        },
      });
    } catch (sendErr) {
      console.error("Failed to send application confirmation:", sendErr);
      return new Response(
        JSON.stringify({ error: 'E-postutskicket misslyckades' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Application confirmation sent", { sent: !!data });

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
