import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

// Retained only so stale links fail safely during rollout. Historical query
// parameters carried reset credentials and must never be parsed, logged,
// copied or forwarded. New reset links go directly to the canonical /auth
// route through Supabase's native recovery flow.
const handler = (req: Request): Response => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  return new Response(
    JSON.stringify({
      code: "reset_redirect_retired",
      message: "Begär en ny lösenordsåterställningslänk.",
    }),
    { status: 410, headers },
  );
};

serve(handler);
