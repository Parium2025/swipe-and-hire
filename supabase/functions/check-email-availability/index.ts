import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { enforceRateLimit, normalizeEmail, requestIp } from "../_shared/rate-limit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

/**
 * Kontrollerar om en e-postadress redan har ett konto, så att
 * registreringsformuläret kan visa "Det här kontot finns redan".
 *
 * Enumeration-skydd: hård rate limiting per IP. Signup-flödet i övrigt
 * fortsätter att svara generiskt.
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return json({ exists: false, checked: false });
    }

    const limited = await enforceRateLimit(
      supabase,
      "check-email-availability",
      [
        { scope: "ip", identifier: requestIp(req), limit: 60, windowSeconds: 60 * 10 },
        { scope: "email", identifier: normalizedEmail, limit: 10, windowSeconds: 60 * 10 },
      ],
      corsHeaders,
    );
    // Vid rate limit: svara neutralt istället för fel — UI ska inte störa användaren.
    if (limited) return json({ exists: false, checked: false });

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, role")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("check-email-availability query failed", error.message);
      return json({ exists: false, checked: false });
    }

    return json({ exists: !!data, checked: true, role: data?.role ?? null });
  } catch (e) {
    console.error("check-email-availability error", e);
    return json({ exists: false, checked: false });
  }
});
