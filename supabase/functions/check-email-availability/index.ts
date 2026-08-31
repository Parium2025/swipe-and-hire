import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { genericPublicAuthResponse } from "../_shared/public-auth-security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Behåller den gamla endpointen kompatibel medan klienterna migreras bort
 * från förhandskontroll. Svaret är alltid neutralt och avslöjar aldrig om
 * adressen, rollen eller kontots status finns i auth.
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return genericPublicAuthResponse(corsHeaders);
});
