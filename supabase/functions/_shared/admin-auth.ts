// Inline admin check for edge functions. Returns null when caller is an active
// admin (from public.user_roles) or service_role, otherwise 401/403 Response.
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseJwtClaims } from "./service-auth.ts";

export async function requireAdmin(req: Request, corsHeaders: Record<string, string> = {}): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return null;
  const claims = parseJwtClaims(token);
  if (claims?.role === "service_role") return null;
  const sub = typeof claims?.sub === "string" ? claims.sub : null;
  if (!sub) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey!);
  const { data, error } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", sub)
    .eq("role", "admin")
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
