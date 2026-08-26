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

  const caller = await verifyCaller(req, corsHeaders);
  if (caller instanceof Response) return caller;
  if (!caller.userId) return json({ error: "Unauthorized" }, 401);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = RequestSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "Ogiltig inbjudningslänk." }, 400);

  const tokenHash = await sha256Hex(parsed.data.token);

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

  const { data: existingRole } = await supabaseAdmin
    .from("user_roles")
    .select("id, is_active")
    .eq("user_id", caller.userId)
    .eq("organization_id", invitation.organization_id)
    .maybeSingle();

  if (existingRole) {
    const { error: updateRoleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: invitation.role, is_active: true })
      .eq("id", existingRole.id);
    if (updateRoleError) {
      console.error("role update failed", updateRoleError);
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
      return json({ error: "Kunde inte koppla dig till teamet." }, 500);
    }
  }

  await supabaseAdmin
    .from("profiles")
    .update({ organization_id: invitation.organization_id })
    .eq("user_id", caller.userId);

  await supabaseAdmin
    .from("organization_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: caller.userId,
    })
    .eq("id", invitation.id);

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("name")
    .eq("id", invitation.organization_id)
    .maybeSingle();

  return json({ success: true, organizationName: org?.name ?? null, role: invitation.role });
});
