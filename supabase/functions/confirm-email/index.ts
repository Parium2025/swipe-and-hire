import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { enforceRateLimit, requestIp } from "../_shared/rate-limit.ts";
import {
  readBoundedJson,
  sha256Hex,
  withTimeout,
} from "../_shared/public-auth-security.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 4_096;
const OPERATION_TIMEOUT_MS = 8_000;

interface ConfirmRequest {
  token?: unknown;
}

interface ConfirmationCandidate {
  confirmation_id: string;
  user_id: string;
}

function genericConfirmationResponse(
  processed = false,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      processed: processed && status === 200,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        ...extraHeaders,
      },
    },
  );
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders, "Cache-Control": "no-store" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Allow": "POST, OPTIONS",
      },
    });
  }

  let token = "";
  try {
    const body = await readBoundedJson<ConfirmRequest>(req, MAX_BODY_BYTES);
    if (!body) return genericConfirmationResponse();
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return genericConfirmationResponse();
  }

  if (!UUID_TOKEN_RE.test(token)) {
    return genericConfirmationResponse();
  }

  const tokenHash = await sha256Hex(token);
  const rateLimitResponse = await enforceRateLimit(
    supabase,
    "confirm-email",
    [
      { scope: "ip", identifier: requestIp(req), limit: 30, windowSeconds: 60 * 60 },
      { scope: "token", identifier: tokenHash, limit: 5, windowSeconds: 15 * 60 },
    ],
    corsHeaders,
  );
  if (rateLimitResponse) {
    const retryAfter = rateLimitResponse.headers.get("Retry-After");
    return genericConfirmationResponse(
      false,
      rateLimitResponse.status,
      retryAfter ? { "Retry-After": retryAfter } : {},
    );
  }

  try {
    const { data, error } = await withTimeout(
      () => supabase.rpc("lookup_email_confirmation_token", {
        _token_digest: tokenHash,
        _raw_token: token,
      }),
      OPERATION_TIMEOUT_MS,
      "Confirmation lookup timed out",
    );

    if (error) {
      console.error("confirmation lookup failed", { code: error.code ?? "unknown" });
      return genericConfirmationResponse(false, 503);
    }

    const confirmation = (Array.isArray(data) ? data[0] : null) as
      | ConfirmationCandidate
      | null;
    if (!confirmation?.user_id) {
      return genericConfirmationResponse();
    }

    const { error: updateError } = await withTimeout(
      () => supabase.auth.admin.updateUserById(confirmation.user_id, {
        email_confirm: true,
      }),
      OPERATION_TIMEOUT_MS,
      "Email confirmation timed out",
    );

    if (updateError) {
      console.error("email confirmation update failed", {
        code: updateError.code ?? "unknown",
      });
      return genericConfirmationResponse(false, 503);
    }

    const { data: finalized, error: finalizeError } = await withTimeout(
      () => supabase.rpc("finalize_email_confirmation_token", {
        _confirmation_id: confirmation.confirmation_id,
        _token_digest: tokenHash,
        _raw_token: token,
      }),
      OPERATION_TIMEOUT_MS,
      "Confirmation finalize timed out",
    );

    if (finalizeError) {
      console.error("confirmation finalize failed", {
        code: finalizeError.code ?? "unknown",
      });
      return genericConfirmationResponse(false, 503);
    }

    return finalized === true
      ? genericConfirmationResponse(true)
      : genericConfirmationResponse();
  } catch (error: unknown) {
    console.error("confirm-email request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return genericConfirmationResponse(false, 503);
  }
};

serve(handler);
