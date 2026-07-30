// Skickar om kontobekräftelse via Lovable Emails (send-transactional-email).
// Ersätter tidigare Resend-baserad implementation. Callers (useAuth) behöver inte ändras.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { enforceRateLimit, normalizeEmail, requestIp } from "../_shared/rate-limit.ts";
import { findUserByEmail } from "../_shared/find-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

interface ResendRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = (await req.json()) as ResendRequest;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return new Response(
        JSON.stringify({ error: "Email krävs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rateLimitResponse = await enforceRateLimit(
      supabaseAdmin,
      "resend-confirmation",
      [
        { scope: "email", identifier: normalizedEmail, limit: 3, windowSeconds: 60 * 60 },
        { scope: "ip", identifier: requestIp(req), limit: 10, windowSeconds: 60 * 60 },
      ],
      corsHeaders,
    );
    if (rateLimitResponse) return rateLimitResponse;

    console.log("Resending confirmation", { hasEmail: true });

    // 1) Hitta användaren via admin-API.
    const user = await findUserByEmail(supabaseAdmin, normalizedEmail);
    if (!user) {
      // Ge generisk framgång för att inte avslöja huruvida adressen finns.
      return new Response(
        JSON.stringify({ success: true, message: "Om adressen finns skickas ett mejl." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (user.email_confirmed_at) {
      return new Response(
        JSON.stringify({
          success: false,
          alreadyConfirmed: true,
          message: "Kontot är redan bekräftat. Du kan logga in direkt.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Skapa ny bekräftelsetoken i egen tabell (samma mönster som custom-signup).
    const confirmationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24 * 7); // 7 dagars giltighet

    // Rensa gamla tokens för användaren först
    await supabaseAdmin
      .from("email_confirmations")
      .delete()
      .eq("user_id", user.id);

    const { error: tokenError } = await supabaseAdmin
      .from("email_confirmations")
      .insert({
        user_id: user.id,
        token: confirmationToken,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("Failed to create confirmation token:", tokenError);
      throw new Error("Kunde inte skapa bekräftelselänk");
    }

    const confirmationUrl = `https://parium.se/email-confirm?confirm=${confirmationToken}`;

    // 3) Hämta metadata för mall-personalisering.
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const role = metadata.role === "employer" ? "employer" : "job_seeker";
    const firstName = (metadata.first_name as string) || "där";
    const companyName = (metadata.company_name as string) || "ert företag";

    // 4) Skicka via Lovable Emails.
    const idempotencyKey = `resend-confirm-${user.id}-${Date.now()}`;
    const { data, error } = await supabaseAdmin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "account-confirmation",
        recipientEmail: normalizedEmail,
        idempotencyKey,
        templateData: {
          first_name: firstName,
          confirmation_url: confirmationUrl,
          role,
          company_name: companyName,
        },
      },
    });

    if (error) {
      console.error("send-transactional-email failed:", error);
      return new Response(
        JSON.stringify({ error: error.message || "send-transactional-email failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Resend confirmation queued via Lovable Emails");
    return new Response(
      JSON.stringify({ success: true, message: "Ny bekräftelselänk skickad!", data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("resend-confirmation error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

serve(handler);
