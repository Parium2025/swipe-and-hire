// Skickar återställningsmejl via Lovable Emails (hanterad e-postleverans).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { enforceRateLimit, normalizeEmail, requestIp } from "../_shared/rate-limit.ts";
import {
  genericPublicAuthResponse,
  readBoundedJson,
  runAuthBackgroundTask,
  withTimeout,
} from "../_shared/public-auth-security.ts";
import { sendLoggedTemplateEmail } from "../_shared/transactional-email-templates/send-logged-email.ts";
import { resolveResetAppOrigin } from "./reset-origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXTERNAL_TIMEOUT_MS = 10_000;

interface ResetPasswordRequest {
  email?: unknown;
}

async function processReset(
  normalizedEmail: string,
  ip: string,
  appOrigin: string,
): Promise<void> {
  const limited = await enforceRateLimit(
    supabaseAdmin,
    "send-reset-password",
    [
      { scope: "ip", identifier: ip, limit: 20, windowSeconds: 60 * 60 },
      { scope: "email", identifier: normalizedEmail, limit: 5, windowSeconds: 60 * 60 },
    ],
    corsHeaders,
  );
  if (limited) return;

  const { data: linkData, error: linkError } = await withTimeout(
    () => supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo: `${appOrigin}/auth?reset=true` },
    }),
    EXTERNAL_TIMEOUT_MS,
    "Recovery link generation timed out",
  );
  if (linkError || !linkData?.properties?.action_link) {
    console.warn("password reset link unavailable", {
      code: linkError?.code ?? "not_found",
    });
    return;
  }

  const delivery = await withTimeout(
    () => sendLoggedTemplateEmail("password-reset", normalizedEmail, {
      idempotencyKey: `password-reset-${crypto.randomUUID()}`,
      templateData: { reset_url: linkData.properties.action_link },
    }),
    EXTERNAL_TIMEOUT_MS,
    "Password reset mail timed out",
  );

  if (!delivery.sent) {
    console.warn("password reset mail suppressed");
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const appOrigin = resolveResetAppOrigin({
    deploymentEnv: Deno.env.get("PARIUM_DEPLOYMENT_ENV"),
    configuredOrigin: Deno.env.get("PARIUM_RESET_APP_ORIGIN"),
  });
  if (!appOrigin) {
    console.warn("password reset origin configuration unavailable");
    return genericPublicAuthResponse(corsHeaders);
  }

  let normalizedEmail = "";
  try {
    const body = await readBoundedJson<ResetPasswordRequest>(req);
    if (!body) return genericPublicAuthResponse(corsHeaders);
    normalizedEmail = normalizeEmail(
      typeof body.email === "string" ? body.email : "",
    );
  } catch {
    return genericPublicAuthResponse(corsHeaders);
  }

  if (!EMAIL_RE.test(normalizedEmail)) {
    return genericPublicAuthResponse(corsHeaders);
  }

  const ip = requestIp(req);
  runAuthBackgroundTask("send-reset-password", () =>
    processReset(normalizedEmail, ip, appOrigin)
  );
  return genericPublicAuthResponse(corsHeaders);
};

serve(handler);
