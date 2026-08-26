import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCaller } from "../_shared/service-auth.ts";
import { sendLoggedTemplateEmail } from "../_shared/transactional-email-templates/send-logged-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  recruiter: "Rekryterare",
  viewer: "Läsare",
};

const RequestSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(["admin", "recruiter", "viewer"]),
  origin: z.string().url().max(300).optional(),
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
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400);
  }
  const email = parsed.data.email.trim().toLowerCase();
  const { role } = parsed.data;

  // Resolve caller organization and verify admin rights server-side.
  const { data: organizationId, error: orgError } = await supabaseAdmin.rpc(
    "get_user_organization_id",
    { p_user_id: caller.userId },
  );
  if (orgError || !organizationId) {
    return json({ error: "Ingen organisation hittades för ditt konto." }, 400);
  }

  const { data: isAdmin, error: adminError } = await supabaseAdmin.rpc("is_org_admin", {
    p_user_id: caller.userId,
    p_organization_id: organizationId,
  });
  if (adminError || isAdmin !== true) {
    return json({ error: "Endast administratörer kan bjuda in kollegor." }, 403);
  }

  // Already a member of this organization?
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .ilike("email", email)
    .maybeSingle();

  if (existingProfile?.user_id) {
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", existingProfile.user_id)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .maybeSingle();
    if (existingRole) {
      return json({ error: "Personen är redan medlem i teamet." }, 409);
    }
  }

  // Expire stale pending invitations before checking for duplicates.
  await supabaseAdmin
    .from("organization_invitations")
    .update({ status: "expired" })
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  const { data: pending } = await supabaseAdmin
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .ilike("email", email)
    .maybeSingle();

  if (pending) {
    // Re-inviting replaces the old invitation so the newest link is the valid one.
    await supabaseAdmin
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("id", pending.id);
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { data: invitation, error: insertError } = await supabaseAdmin
    .from("organization_invitations")
    .insert({
      organization_id: organizationId,
      email,
      role,
      token_hash: tokenHash,
      invited_by: caller.userId,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, email, role, status, expires_at, created_at")
    .single();

  if (insertError || !invitation) {
    console.error("invitation insert failed", insertError);
    return json({ error: "Kunde inte skapa inbjudan." }, 500);
  }

  const [{ data: org }, { data: inviterProfile }] = await Promise.all([
    supabaseAdmin.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, company_name")
      .eq("user_id", caller.userId)
      .maybeSingle(),
  ]);

  const companyName = org?.name || inviterProfile?.company_name || "teamet";
  const inviterName = [inviterProfile?.first_name, inviterProfile?.last_name]
    .filter(Boolean)
    .join(" ") || "En kollega";

  const baseUrl = parsed.data.origin?.replace(/\/+$/, "") || "https://parium.se";
  const acceptUrl = `${baseUrl}/team-invite?token=${token}`;

  try {
    await sendLoggedTemplateEmail("team-invitation", email, {
      idempotencyKey: `team-invite-${invitation.id}`,
      templateData: {
        company_name: companyName,
        inviter_name: inviterName,
        role_label: ROLE_LABELS[role] ?? role,
        accept_url: acceptUrl,
        expires_at: expiresAt.toLocaleDateString("sv-SE", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      },
    });
  } catch (error) {
    console.error("invitation email failed", error);
    await supabaseAdmin
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("id", invitation.id);
    return json({ error: "Inbjudan kunde inte mejlas. Försök igen." }, 502);
  }

  return json({ success: true, invitation });
});
