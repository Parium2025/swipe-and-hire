import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// This function is called via Supabase's internal hook URL pattern:
//   /functions/v1/re_<hook_id>/email-confirm?confirm=TOKEN
// It only needs to redirect the browser to the frontend /email-confirm route
// so the React app can handle the actual confirmation flow.
const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const token = url.searchParams.get("confirm");

  console.log("email-confirm hook accessed with token:", token);

  const envRedirect = Deno.env.get("REDIRECT_URL") || "";
  const defaultRedirect = "https://swipe-and-hire.lovable.app";

  // If REDIRECT_URL mistakenly points to a Supabase domain, fall back to app URL
  const redirectBase = envRedirect.includes("supabase.co")
    ? defaultRedirect
    : envRedirect || defaultRedirect;

  if (!token) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${redirectBase}/email-confirm?error=missing_token`,
      },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${redirectBase}/email-confirm?confirm=${encodeURIComponent(
        token,
      )}`,
    },
  });
};

serve(handler);
