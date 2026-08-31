// Skickar kontobekräftelse via Lovable Emails (hanterad e-postleverans).
// Ersätter tidigare Resend-baserad implementation. Callers behöver inte ändras.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireServiceRole } from "../_shared/service-auth.ts";
import { withTimeout } from "../_shared/public-auth-security.ts";
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

async function confirmationIdempotencyKey(email: string, confirmationUrl: string): Promise<string> {
  const material = new TextEncoder().encode(`${email}\u0000${confirmationUrl}`);
  const digest = await crypto.subtle.digest("SHA-256", material);
  const fingerprint = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `account-confirm-${fingerprint}`;
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

    // Deterministic retries without persisting the recipient or token in the key.
    const idempotencyKey = await confirmationIdempotencyKey(email, confirmation_url);

    const isEmployer = role === "employer";

    let data;
    try {
      data = await withTimeout(
        () => sendLoggedTemplateEmail(
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
        ),
        10_000,
        "Confirmation mail timed out",
      );
    } catch (sendErr) {
      console.error("confirmation mail failed", {
        name: sendErr instanceof Error ? sendErr.name : "UnknownError",
      });
      const error = { message: "E-postutskicket misslyckades" };
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!data.sent) {
      console.warn("confirmation mail suppressed");
    }
    console.log("Confirmation email queued via Lovable Emails", { role });
    return new Response(
      JSON.stringify({ success: true, delivered: data.sent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-confirmation-email failed", {
      name: err instanceof Error ? err.name : "UnknownError",
    });
    return new Response(
      JSON.stringify({ error: "Bekräftelsemejlet kunde inte skickas" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

serve(handler);
