// Public image proxy for HR news cards.
// Purpose: Many news sites block hotlinking from browsers. This function fetches the image server-side and
// returns it as a normal image response so the frontend can display it reliably.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeHtmlEntities(str: string): string {
  return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function isLikelyVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    const id = requestUrl.searchParams.get("id");

    if (!id) {
      return new Response("Missing id", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("daily_hr_news")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();

    if (error || !data?.image_url) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const imageUrl = decodeHtmlEntities(data.image_url);
    if (!imageUrl || isLikelyVideo(imageUrl)) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const upstream = await fetch(imageUrl, {
      headers: {
        // Some publishers require a UA to avoid 412/403
        "User-Agent": "Mozilla/5.0 (compatible; PariumNewsBot/1.0)",
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, {
        status: 502,
        headers: corsHeaders,
      });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response("Unsupported media type", {
        status: 415,
        headers: corsHeaders,
      });
    }

    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        // Cache for a day; client can revalidate as needed.
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
