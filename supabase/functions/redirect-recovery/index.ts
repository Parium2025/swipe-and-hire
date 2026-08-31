import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS",
};

const sensitiveHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

// Legacy compatibility endpoint only. It deliberately never inspects the URL:
// old `t` query values can contain bearer credentials and must not be decoded.
const handler = (_req: Request): Response => {
  if (_req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: sensitiveHeaders });
  }

  return new Response(
    JSON.stringify({
      code: "recovery_redirect_retired",
      message: "Begär en ny lösenordsåterställningslänk.",
    }),
    { status: 410, headers: sensitiveHeaders },
  );
};

serve(handler);
