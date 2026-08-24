// Skickar kontobekräftelse via Lovable Emails (send-transactional-email).
// Ersätter tidigare Resend-baserad implementation. Callers behöver inte ändras.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { requireServiceRole } from "../_shared/service-auth.ts";
import { sendLoggedTemplateEmail } from '../_shared/transactional-email-templates/send-logged-email.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ConfirmationEmailRequest {
  email: string;
  role: "job_seeker" | "employer";
  first_name: string;
  confirmation_url: string;
  company_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Internal-only: called by custom-signup with service-role key.
  const authErr = requireServiceRole(req, corsHeaders);
  if (authErr) return authErr;


  try {
    const body = (await req.json()) as ConfirmationEmailRequest;
    const { email, role, first_name, confirmation_url, company_name } = body;

    if (!email || !confirmation_url) {
      return new Response(
        JSON.stringify({ error: "email och confirmation_url krävs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Idempotens-nyckel: unik per (email + confirmation_url) så retries inte dubblerar.
    const idempotencyKey = `account-confirm-${email}-${confirmation_url.slice(-32)}`;

    const isEmployer = role === "employer";

    let data;
    try {
      data = await sendLoggedTemplateEmail(
        isEmployer ? "employer-account-confirmation" : "account-confirmation",
        email,
        {
          idempotencyKey,
          templateData: isEmployer
            ? {
                first_name: first_name || "där",
                confirmation_url,
                company_name: company_name || "ert företag",
              }
            : {
                first_name: first_name || "där",
                confirmation_url,
              },
        },
      );
    } catch (sendErr) {
      console.error("confirmation email failed:", sendErr);
      const error = { message: "E-postutskicket misslyckades" };
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Confirmation email queued via Lovable Emails", { role });
    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-confirmation-email error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

serve(handler);
