import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Redirect hook for auth-related links like:
//   /functions/v1/re_<hook_id>/auth?token=...
// It simply forwards the browser to the frontend /auth route
// and keeps all query parameters (so our React app/AuthTokenBridge
// kan ta hand om tokens och fortsätta flödet).
const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  console.log("auth hook accessed:", url.toString());

  const envRedirect = Deno.env.get("REDIRECT_URL") || "";
  const defaultRedirect = "https://swipe-and-hire.lovable.app";

  // Om REDIRECT_URL av misstag pekar mot en Supabase-domän, fall back till app-URL
  const redirectBase = envRedirect.includes("supabase.co")
    ? defaultRedirect
    : envRedirect || defaultRedirect;

  const target = new URL("/auth", redirectBase);
  // Behåll alla query-parametrar (t.ex. token, type, redirect_to osv.)
  target.search = url.search;

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
    },
  });
};

serve(handler);
