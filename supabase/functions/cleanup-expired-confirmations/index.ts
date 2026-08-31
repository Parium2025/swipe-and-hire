import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CLEANUP_BATCH_SIZE = 1_000;
const MAX_CLEANUP_BATCHES = 5;
const CLEANUP_TIME_BUDGET_MS = 8_000;

interface CleanupBatchResult {
  legacy_deleted: number;
  token_deleted: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // Endast bakgrundsjobb (service role / cron) får städa bearer-capabilities.
  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authResp) return authResp;

  try {
    const startedAt = Date.now();
    let batches = 0;
    let legacyDeleted = 0;
    let tokenDeleted = 0;

    while (
      batches < MAX_CLEANUP_BATCHES &&
      Date.now() - startedAt < CLEANUP_TIME_BUDGET_MS
    ) {
      const { data, error } = await supabase
        .rpc('cleanup_expired_email_confirmation_capabilities', {
          _batch_size: CLEANUP_BATCH_SIZE,
        });

      if (error) {
        console.error('Error deleting expired confirmation capabilities:', {
          code: error.code ?? 'unknown',
        });
        throw error;
      }

      const row = (Array.isArray(data) ? data[0] : null) as CleanupBatchResult | null;
      const legacyBatch = Number(row?.legacy_deleted ?? 0);
      const tokenBatch = Number(row?.token_deleted ?? 0);
      legacyDeleted += Number.isFinite(legacyBatch) ? legacyBatch : 0;
      tokenDeleted += Number.isFinite(tokenBatch) ? tokenBatch : 0;
      batches += 1;

      if (legacyBatch < CLEANUP_BATCH_SIZE && tokenBatch < CLEANUP_BATCH_SIZE) {
        break;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      legacy_deleted: legacyDeleted,
      token_deleted: tokenDeleted,
      batches,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown cleanup error";
    console.error("Error in cleanup function:", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
