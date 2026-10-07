import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verifyCaller } from "../_shared/service-auth.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RequestSchema = z.object({
  token: z.string().min(20).max(200).regex(/^[a-f0-9]+$/i),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = RequestSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "Ogiltig inbjudningslänk." }, 400);

  const tokenHash = await sha256Hex(parsed.data.token);

  // Förhandsvisning utan inloggning: länkens innehavare får veta vilket
  // företag och vilken adress inbjudan gäller, och om adressen redan har ett
  // konto — så sidan kan visa rätt nästa steg (logga in eller skapa konto).
  if ((payload as { preview?: unknown })?.preview === true) {
    const { data: inv } = await supabaseAdmin
      .from("organization_invitations")
      .select("organization_id, email, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!inv) return json({ error: "Inbjudan hittades inte." }, 404);
    if (inv.status === "accepted") {
      const { data: org } = await supabaseAdmin
        .from("organizations").select("name").eq("id", inv.organization_id).maybeSingle();
      return json({ alreadyAccepted: true, email: inv.email, organizationName: org?.name ?? null });
    }
    if (inv.status !== "pending") return json({ error: "Inbjudan är återkallad." }, 409);
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      return json({ error: "Inbjudan har gått ut." }, 410);
    }
    const [{ data: org }, { data: registered }, { data: authRows }] = await Promise.all([
      supabaseAdmin.from("organizations").select("name").eq("id", inv.organization_id).maybeSingle(),
      supabaseAdmin.rpc("auth_email_registered", { _email: inv.email }),
      supabaseAdmin.rpc("lookup_auth_email_for_resend", { _email: inv.email }),
    ]);
    // Visa direkt om adressen redan är ett jobbsökarkonto, i stället för
    // att låta personen logga in först och sedan få beskedet.
    const authRow = Array.isArray(authRows) ? authRows[0] : authRows;
    if (authRow?.user_id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("role").eq("user_id", authRow.user_id).maybeSingle();
      if ((prof?.role ?? authRow.account_role) === "job_seeker") {
        return json(
          { error: "Den här adressen har redan ett jobbsökarkonto. Be om en inbjudan till din företagsmejl." },
          409,
        );
      }
    }
    return json({
      email: inv.email,
      organizationName: org?.name ?? null,
      accountExists: registered === true,
    });
  }

  const caller = await verifyCaller(req, corsHeaders);
  if (caller instanceof Response) return caller;
  if (!caller.userId) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await supabaseAdmin.rpc("accept_team_invitation", {
    p_user_id: caller.userId,
    p_email: caller.email || "",
    p_token_hash: tokenHash,
  });
  if (error) {
    console.error("atomic invitation acceptance failed", error.code);
    return json({ error: "Kunde inte koppla dig till teamet. Försök igen." }, 500);
  }
  if (data?.success) return json(data);
  const failures: Record<string, [number, string]> = {
    not_found: [404, "Inbjudan hittades inte."],
    wrong_email: [403, "Inbjudan gäller en annan e-postadress. Logga in med den adressen."],
    already_used: [409, "Inbjudan är redan använd."],
    revoked: [409, "Inbjudan är återkallad."],
    expired: [410, "Inbjudan har gått ut."],
    other_org: [409, "Ditt konto tillhör redan ett annat företag på Parium. Be om en inbjudan till en annan jobbmejl."],
    profile_required: [409, "Du behöver ett arbetsgivarkonto med den inbjudna adressen. Jobbsökarkonton kan inte gå med i team."],
    invalid_role: [409, "Inbjudan har en ogiltig roll. Be om en ny inbjudan."],
  };
  const [status, message] = failures[data?.code] ?? [500, "Kunde inte koppla dig till teamet. Försök igen."];
  return json({ error: message }, status);
});
