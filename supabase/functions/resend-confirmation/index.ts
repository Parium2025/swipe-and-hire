// Skickar om kontobekräftelse via Lovable Emails (hanterad e-postleverans).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { enforceRateLimit, normalizeEmail, requestIp } from "../_shared/rate-limit.ts";
import {
  genericPublicAuthResponse,
  readBoundedJson,
  runAuthBackgroundTask,
  sha256Hex,
  withTimeout,
} from "../_shared/public-auth-security.ts";
import { sendLoggedTemplateEmail } from "../_shared/transactional-email-templates/send-logged-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAIL_TIMEOUT_MS = 10_000;

interface ResendRequest {
  email?: unknown;
}

interface ResendLookupRow {
  user_id: string;
  email_confirmed: boolean;
  account_role: "job_seeker" | "employer";
  first_name: string | null;
  company_name: string | null;
}

async function processResend(normalizedEmail: string, ip: string): Promise<void> {
  const limited = await enforceRateLimit(
    supabaseAdmin,
    "resend-confirmation",
    [
      { scope: "ip", identifier: ip, limit: 20, windowSeconds: 60 * 60 },
      { scope: "email", identifier: normalizedEmail, limit: 5, windowSeconds: 60 * 60 },
    ],
    corsHeaders,
  );
  if (limited) return;

  const { data, error } = await supabaseAdmin.rpc("lookup_auth_email_for_resend", {
    _email: normalizedEmail,
  });
  if (error) {
    console.error("resend lookup failed", { code: error.code ?? "unknown" });
    return;
  }

  const row = (Array.isArray(data) ? data[0] : null) as ResendLookupRow | null;
  if (!row || row.email_confirmed) return;

  const confirmationToken = crypto.randomUUID();
  const confirmationTokenHash = await sha256Hex(confirmationToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const isEmployer = row.account_role === "employer";
  const confirmationUrl = `https://www.parium.se/email-confirm#confirm=${confirmationToken}`;

  // Persist before delivery. Every resend gets its own digest-backed one-time
  // capability, so concurrent mails cannot invalidate each other.
  const { error: issueError } = await supabaseAdmin.rpc(
    "issue_email_confirmation_token",
    {
      _user_id: row.user_id,
      _email: normalizedEmail,
      _raw_token: confirmationToken,
      _token_digest: confirmationTokenHash,
      _expires_at: expiresAt,
    },
  );
  if (issueError) {
    console.error("confirmation token issue failed", {
      code: issueError.code ?? "unknown",
    });
    return;
  }

  const delivery = await withTimeout(
    () => sendLoggedTemplateEmail(
      isEmployer ? "employer-account-confirmation" : "account-confirmation",
      normalizedEmail,
      {
        idempotencyKey: `resend-confirm-${row.user_id}-${crypto.randomUUID()}`,
        templateData: isEmployer
          ? {
              first_name: row.first_name || "där",
              confirmation_url: confirmationUrl,
              company_name: row.company_name || "ert företag",
            }
          : {
              first_name: row.first_name || "där",
              confirmation_url: confirmationUrl,
            },
      },
    ),
    MAIL_TIMEOUT_MS,
    "Confirmation resend timed out",
  );

  if (!delivery.sent) {
    console.warn("confirmation resend suppressed");
    return;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let normalizedEmail = "";
  try {
    const body = await readBoundedJson<ResendRequest>(req);
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
  runAuthBackgroundTask("resend-confirmation", () => processResend(normalizedEmail, ip));
  return genericPublicAuthResponse(corsHeaders);
};

serve(handler);
