/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function toBase64(bytes: Uint8Array): string {
  // Convert bytes -> binary string -> base64. Chunk to avoid call stack limits.
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Optional override, else infer from request origin (preview/published)
    let imgUrl = url.searchParams.get("url") || "";
    if (!imgUrl) {
      const origin = req.headers.get("origin") || "";
      const referer = req.headers.get("referer") || "";
      const base = origin || (referer ? new URL(referer).origin : "");
      if (base) {
        imgUrl = new URL("/lovable-uploads/parium-auth-logo.png", base).toString();
      } else {
        // Fallback to the production URL if no origin is available.
        imgUrl = "https://parium-ab.lovable.app/lovable-uploads/parium-auth-logo.png";
      }
    }

    const r = await fetch(imgUrl, { cache: "no-store" });
    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch image: ${r.status}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const ct = r.headers.get("content-type") || "image/png";
    const buf = new Uint8Array(await r.arrayBuffer());
    const b64 = toBase64(buf);

    // Tooling-safe mode: return base64 in chunks.
    const chunkSize = Math.max(1024, Math.min(20000, parseInt(url.searchParams.get("chunkSize") || "12000", 10) || 12000));
    const partParam = url.searchParams.get("part");
    const totalLen = b64.length;
    const parts = Math.ceil(totalLen / chunkSize);

    if (!partParam) {
      return new Response(
        JSON.stringify({
          bytes: buf.length,
          contentType: ct,
          b64Length: totalLen,
          chunkSize,
          parts,
          prefix: `data:${ct};base64,`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const part = Math.max(0, Math.min(parts - 1, parseInt(partParam, 10) || 0));
    const start = part * chunkSize;
    const end = Math.min(totalLen, start + chunkSize);
    const b64Chunk = b64.slice(start, end);

    return new Response(
      JSON.stringify({ part, start, end, chunkSize, parts, b64Chunk }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );

    // Fallback (unused): full dataUri response
    // const dataUri = `data:${ct};base64,${b64}`;
    // return new Response(JSON.stringify({ dataUri, contentType: ct, bytes: buf.length }), {
    //   headers: { ...corsHeaders, "Content-Type": "application/json" },
    // });
  
    // eslint-disable-next-line no-unreachable
    return new Response("", { status: 500 });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
