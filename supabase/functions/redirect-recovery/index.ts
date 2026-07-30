import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowlist: endast dessa värdar accepteras som redirect-mål
const ALLOWED_HOSTS = new Set<string>([
  "parium.se",
  "www.parium.se",
  "parium-ab.lovable.app",
]);
// Wildcard-suffix (t.ex. Lovable preview-domäner)
const ALLOWED_SUFFIXES = [".lovable.app", ".lovable.dev"];

const FALLBACK = "https://parium.se/auth";

function isAllowed(target: string): boolean {
  try {
    const u = new URL(target);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host)) return true;
    return ALLOWED_SUFFIXES.some((suf) => host.endsWith(suf));
  } catch {
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    let decodedUrl = "";
    try {
      decodedUrl = atob(token);
    } catch {
      return new Response(null, {
        status: 302,
        headers: { Location: FALLBACK, ...corsHeaders },
      });
    }

    if (!isAllowed(decodedUrl)) {
      let blockedHost = "invalid";
      try {
        blockedHost = new URL(decodedUrl).hostname;
      } catch {
        blockedHost = "unparseable";
      }
      console.warn("redirect-recovery blocked non-allowlisted target", { blockedHost });
      return new Response(null, {
        status: 302,
        headers: { Location: FALLBACK, ...corsHeaders },
      });
    }

    return new Response(null, {
      status: 302,
      headers: { Location: decodedUrl, ...corsHeaders },
    });
  } catch (error) {
    console.error("Error in redirect-recovery:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: FALLBACK, ...corsHeaders },
    });
  }
};

serve(handler);
