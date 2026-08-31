import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { enforceRateLimit, normalizeEmail, requestIp } from "../_shared/rate-limit.ts";
import { runDurableSignup } from "./orchestrator.ts";
import {
  approvedAppOrigin,
  fetchWithTimeout,
  genericPublicAuthResponse,
  isValidPublicSignupEmail,
  isValidPublicSignupPassword,
  readBoundedJson,
  runAuthBackgroundTask,
  sanitizeSignupMetadata,
  sha256Hex,
  waitForPublicAuthResponseFloor,
} from "../_shared/public-auth-security.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SignupRequest {
  email?: unknown;
  password?: unknown;
  data?: Record<string, unknown>;
}

interface ConfirmationMailDelivery {
  email: string;
  role: string;
  firstName?: string;
  companyName?: string;
  confirmationUrl: string;
}

const isExistingUserError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes("already been registered") ||
    normalized.includes("user already registered") ||
    normalized.includes("email_exists");
};

async function establishSignup(
  normalizedEmail: string,
  password: string,
  metadata: Record<string, string>,
  ip: string,
): Promise<ConfirmationMailDelivery | null> {
  console.log("Attempting signup", { role: metadata.role });

  return runDurableSignup<ConfirmationMailDelivery>({
    reserveRateLimit: async () => {
      const response = await enforceRateLimit(
        supabase,
        "custom-signup",
        [
          { scope: "ip", identifier: ip, limit: 10, windowSeconds: 60 * 60 },
          { scope: "email", identifier: normalizedEmail, limit: 3, windowSeconds: 60 * 60 },
        ],
        corsHeaders,
      );
      return response === null;
    },
    createIdentity: async () => {
      // Auth's unique email identity is the concurrency authority. A separate
      // existence lookup creates a TOCTOU race and amplifies timing signals.
      const { data: user, error } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: false,
        user_metadata: metadata,
        app_metadata: {
          parium_signup_channel: "custom-signup-v1",
        },
      });

      return {
        userId: user?.user?.id ?? null,
        existing: Boolean(error && isExistingUserError(error.message)),
        errorCode: error?.code ?? (user?.user?.id ? undefined : "missing_user_id"),
      };
    },
    issueConfirmation: async (userId) => {
      const confirmationToken = crypto.randomUUID();
      const confirmationTokenHash = await sha256Hex(confirmationToken);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24 * 7);
      const { error } = await supabase.rpc(
        "issue_email_confirmation_token",
        {
          _user_id: userId,
          _email: normalizedEmail,
          _raw_token: confirmationToken,
          _token_digest: confirmationTokenHash,
          _expires_at: expiresAt.toISOString(),
        },
      );

      if (error) {
        return { delivery: null, errorCode: error.code ?? "unknown" };
      }

      const appBase = approvedAppOrigin(Deno.env.get("REDIRECT_URL"));
      return {
        delivery: {
          email: normalizedEmail,
          role: metadata.role,
          firstName: metadata.first_name,
          companyName: metadata.company_name,
          confirmationUrl: `${appBase}/email-confirm#confirm=${confirmationToken}`,
        },
      };
    },
    reportFailure: (stage, code) => {
      console.error("custom-signup critical path failed", { stage, code });
    },
  });
}

async function deliverConfirmationMail(
  delivery: ConfirmationMailDelivery,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Confirmation email delivery unavailable", {
      code: "missing_server_configuration",
    });
    return;
  }

  let emailSent = false;
  let lastErrorCode = "unknown";
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const emailResponse = await fetchWithTimeout(
        `${supabaseUrl}/functions/v1/send-confirmation-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            email: delivery.email,
            role: delivery.role,
            first_name: delivery.firstName,
            confirmation_url: delivery.confirmationUrl,
            company_name: delivery.companyName,
          }),
        },
        10_000,
      );

      const result = emailResponse.ok
        ? await emailResponse.json().catch(() => null) as { delivered?: boolean } | null
        : null;
      if (emailResponse.ok && result?.delivered === true) {
        emailSent = true;
        break;
      }

      if (emailResponse.ok && result?.delivered === false) {
        lastErrorCode = "delivery_suppressed";
        break;
      }

      lastErrorCode = `http_${emailResponse.status}`;
    } catch (error: unknown) {
      lastErrorCode = error instanceof Error ? error.name : "unknown_error";
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (!emailSent) {
    // Account and token are already durable. Resend-confirmation is the
    // recovery path; never delete identity-linked rows after mail failure.
    console.error("Confirmation email delivery failed", { code: lastErrorCode });
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await readBoundedJson<SignupRequest>(req);
    if (!body) return genericPublicAuthResponse(corsHeaders);
    const { email, password, data } = body;
    const normalizedEmail = normalizeEmail(typeof email === "string" ? email : "");
    const metadata = sanitizeSignupMetadata(data);

    if (
      !isValidPublicSignupEmail(normalizedEmail) ||
      !isValidPublicSignupPassword(password) ||
      !metadata
    ) {
      return genericPublicAuthResponse(corsHeaders);
    }

    const responseStartedAt = performance.now();
    const ip = requestIp(req);
    const delivery = await establishSignup(normalizedEmail, password, metadata, ip);
    if (delivery) {
      runAuthBackgroundTask("custom-signup-mail", () => deliverConfirmationMail(delivery));
    }
    await waitForPublicAuthResponseFloor(responseStartedAt);
    return genericPublicAuthResponse(corsHeaders);
  } catch {
    return genericPublicAuthResponse(corsHeaders);
  }
};

serve(handler);
