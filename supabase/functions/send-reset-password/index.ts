// Skickar återställningsmejl via Lovable Emails (send-transactional-email).
// Ersätter tidigare Resend-baserad implementation. Callers (useAuth, Auth.tsx) behöver inte ändras.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { enforceRateLimit, normalizeEmail, requestIp } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

interface ResetPasswordRequest {
  email: string;
  origin?: string;
}

const ALLOWED_ORIGINS = [
  "https://parium.se",
  "https://www.parium.se",
  "https://parium-ab.lovable.app",
];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, origin } = (await req.json()) as ResetPasswordRequest;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return new Response(
        JSON.stringify({ error: "Email krävs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rateLimitResponse = await enforceRateLimit(
      supabaseAdmin,
      "send-reset-password",
      [
        { scope: "email", identifier: normalizedEmail, limit: 5, windowSeconds: 60 * 60 },
        { scope: "ip", identifier: requestIp(req), limit: 20, windowSeconds: 60 * 60 },
      ],
      corsHeaders,
    );
    if (rateLimitResponse) return rateLimitResponse;

    console.log("Preparing password reset", { hasEmail: true });

    // 1) Generera Supabases recovery-länk. Rör inte auth-flödet i övrigt.
    // Använd kanonisk domän som standard, men tillåt kända domäner från klienten för test/preview.
    const redirectTo = `${origin && ALLOWED_ORIGINS.includes(origin) ? origin : "https://parium.se"}/auth?reset=true`;
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      // Avslöja inte om användaren finns eller inte — returnera success ändå
      // så att flödet inte kan användas för e-postuppräkning.
      console.warn("generateLink failed (returning generic success):", linkError?.message);
      return new Response(
        JSON.stringify({ success: true, message: "Om adressen finns skickas ett mejl." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resetUrl = linkData.properties.action_link;

    // 2) Skicka via Lovable Emails.
    const idempotencyKey = `password-reset-${normalizedEmail}-${Date.now()}`;
    const { data, error } = await supabaseAdmin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "password-reset",
        recipientEmail: normalizedEmail,
        idempotencyKey,
        templateData: { reset_url: resetUrl },
      },
    });

    if (error) {
      console.error("send-transactional-email failed:", error);
      return new Response(
        JSON.stringify({ error: error.message || "send-transactional-email failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Reset email queued via Lovable Emails");
    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-reset-password error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

serve(handler);
