import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

// Compatibility tombstone for historical hook URLs that exposed reusable
// confirmation capabilities in the request target. Current confirmation
// emails link directly to /email-confirm with an in-fragment capability.
const handler = (_req: Request): Response =>
  new Response(
    JSON.stringify({
      code: "confirmation_redirect_retired",
      message: "Begär ett nytt bekräftelsemejl.",
    }),
    { status: 410, headers },
  );

serve(handler);
