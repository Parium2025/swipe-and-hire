import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCaller } from "../_shared/service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (inv.status === "accepted") return json({ error: "Inbjudan är redan använd." }, 409);
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

  const { data: invitation, error } = await supabaseAdmin
    .from("organization_invitations")
    .select("id, organization_id, email, role, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !invitation) return json({ error: "Inbjudan hittades inte." }, 404);
  if (invitation.status === "accepted") {
    return json({ error: "Inbjudan är redan använd." }, 409);
  }
  if (invitation.status !== "pending") {
    return json({ error: "Inbjudan är återkallad." }, 409);
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from("organization_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);
    return json({ error: "Inbjudan har gått ut." }, 410);
  }

  // The invitation is bound to the invited address — no one else can claim it.
  const callerEmail = (caller.email || "").toLowerCase();
  if (!callerEmail || callerEmail !== invitation.email.toLowerCase()) {
    return json(
      { error: "Inbjudan gäller en annan e-postadress. Logga in med den adressen." },
      403,
    );
  }

  // En adress kan inte vara både jobbsökare och teammedlem.
  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", caller.userId)
    .maybeSingle();
  if (callerProfile?.role === "job_seeker") {
    return json(
      { error: "Den här adressen har redan ett jobbsökarkonto. Be om en inbjudan till din företagsmejl." },
      409,
    );
  }

  // En person tillhör bara ett företag åt gången.
  const { data: otherOrgRole } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", caller.userId)
    .eq("is_active", true)
    .neq("organization_id", invitation.organization_id)
    .limit(1)
    .maybeSingle();
  if (otherOrgRole) {
    return json(
      { error: "Ditt konto tillhör redan ett annat företag på Parium. Be om en inbjudan till en annan jobbmejl." },
      409,
    );
  }

  // Lås inbjudan atomiskt: bara ett klick/en flik kan använda den, även om
  // "Gå med" trycks två gånger eller länken öppnas på två enheter samtidigt.
  const { data: claimed } = await supabaseAdmin
    .from("organization_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: caller.userId })
    .eq("id", invitation.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) {
    return json({ error: "Inbjudan är redan använd." }, 409);
  }
  const releaseClaim = () =>
    supabaseAdmin
      .from("organization_invitations")
      .update({ status: "pending", accepted_at: null, accepted_by: null })
      .eq("id", invitation.id);

  const { data: existingRole } = await supabaseAdmin
    .from("user_roles")
    .select("id, is_active, role")
    .eq("user_id", caller.userId)
    .eq("organization_id", invitation.organization_id)
    .maybeSingle();

  // Aktiv medlem redan: rör aldrig rollen (en admin får aldrig nedgraderas).
  if (existingRole?.is_active) {
    return json({ success: true, alreadyMember: true });
  }

  if (existingRole) {
    const { error: updateRoleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: invitation.role, is_active: true })
      .eq("id", existingRole.id);
    if (updateRoleError) {
      console.error("role update failed", updateRoleError);
      await releaseClaim();
      return json({ error: "Kunde inte koppla dig till teamet." }, 500);
    }
  } else {
    const { error: insertRoleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: caller.userId,
      organization_id: invitation.organization_id,
      role: invitation.role,
      is_active: true,
    });
    if (insertRoleError) {
      console.error("role insert failed", insertRoleError);
      await releaseClaim();
      return json({ error: "Kunde inte koppla dig till teamet." }, 500);
    }
  }

  await supabaseAdmin
    .from("profiles")
    .update({ organization_id: invitation.organization_id, joined_via_invite: true })
    .eq("user_id", caller.userId);

  // Bolagets uppgifter (namn, logga, bransch m.m.) ärvs från bolaget —
  // medlemmen fyller bara i sina personliga uppgifter i välkomstguiden.
  const { error: copyError } = await supabaseAdmin.rpc("copy_org_company_fields_to_member", {
    p_user_id: caller.userId,
    p_organization_id: invitation.organization_id,
  });
  if (copyError) console.error("company copy failed", copyError);

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("name")
    .eq("id", invitation.organization_id)
    .maybeSingle();

  return json({ success: true, organizationName: org?.name ?? null, role: invitation.role });
});
