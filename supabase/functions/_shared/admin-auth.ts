// Admin authorization for edge functions. Returns null when caller is an
// active admin (from public.user_roles) or the literal service-role key.
//
// ⚠️ SECURITY: caller identity is established via cryptographically-verified
// JWT (Supabase auth.getClaims). Never trust a base64-decoded JWT payload
// alone — that is trivially forgeable when verify_jwt=false.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyCaller } from "./service-auth.ts";

export async function requireAdmin(req: Request, corsHeaders: Record<string, string> = {}): Promise<Response | null> {
  const caller = await verifyCaller(req, corsHeaders);
  if (caller instanceof Response) return caller;
  if (caller.isServiceRole) return null;
  if (!caller.userId) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", caller.userId)
    .eq("role", "admin")
    .is("organization_id", null)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) {
    return new Response(JSON.stringify({ error: "Forbidden - admin required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}
